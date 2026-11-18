import { afterAll, describe, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { ArtifactContent } from "@notra/ai/types/artifact";
import {
  artifactRevisions,
  artifacts,
  autopilotBriefs,
  codeStorageDeletions,
  organizations,
  users,
} from "@notra/db/schema";
import { setRepoStore } from "@notra/memory/repos";
import { createInMemoryRepos } from "@notra/memory/stores/in-memory-repos";
import { and, eq } from "drizzle-orm";

import { createAutopilotSandbox } from "./utils/autopilot-sandbox";

if (process.env.NOTRA_ARTIFACTS_TEST !== "1") {
  test("artifacts on code.storage, against migrated sandbox PostgreSQL", () => {
    const child = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: {
          PATH: process.env.PATH,
          NOTRA_ARTIFACTS_TEST: "1",
          DATABASE_URL: "",
        },
        timeout: 90_000,
      }
    );
    expect(child.status, child.stderr.toString()).toBe(0);
  }, 95_000);
} else {
  const sandbox = await createAutopilotSandbox();
  const db = sandbox.db;
  mock.module("@notra/db/drizzle", () => ({ db }));
  const gate = { on: true };
  mock.module("@/lib/autopilot/flag", () => ({
    isAutopilotEnabledForOrganization: async () => gate.on,
    isAutopilotOffForOrganization: async () => !gate.on,
    autopilotAccessState: async () => (gate.on ? "enabled" : "disabled"),
    resolveAutopilotAvailability: async () =>
      gate.on ? "enabled" : "upgrade_required",
    isAutopilotWorkflowGraphEnabled: async () => false,
  }));
  const repos = createInMemoryRepos();
  const failures = { deleteRepo: false };
  const hooks: {
    afterCommit?: (repoId: string, sha: string) => Promise<void>;
  } = {};
  setRepoStore({
    ...repos,
    async commit(repoId, input) {
      const sha = await repos.commit(repoId, input);
      await hooks.afterCommit?.(repoId, sha);
      return sha;
    },
    async deleteRepo(repoId, signal) {
      if (failures.deleteRepo) {
        throw new Error("code.storage unavailable");
      }
      return repos.deleteRepo(repoId, signal);
    },
  });

  const chat = await import("@notra/ai/chat/artifacts");
  const { artifactToolHandlers } = await import("@notra/ai/tools/artifacts");
  const { deleteArtifact, setArtifactShared } =
    await import("@/lib/artifacts/manage");
  const { cleanupCodeStorageRepos } =
    await import("@/lib/artifacts/repo-deletions");
  const { ensureBriefArtifact } = await import("@/lib/autopilot/brief-page");
  const { loadArtifactView } = await import("@/lib/artifacts/view");

  const ORG = "org-a";
  const writer = { organizationId: ORG, source: "chat" as const };
  const REPORT: ArtifactContent = {
    title: "Weekly AI traffic",
    summary: "Referrals grew 18%.",
    blocks: [
      {
        type: "metrics",
        items: [{ label: "Visits", value: "12.4k", change: "+18%" }],
      },
      { type: "text", markdown: "## What changed\n\nChatGPT grew." },
      {
        type: "table",
        columns: ["Source", "Visits"],
        rows: [
          ["ChatGPT", 8200],
          ["Claude", 2100],
        ],
      },
    ],
  };
  const now = new Date();
  await db.insert(users).values({
    id: "user-a",
    name: "A",
    email: "a@example.invalid",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(organizations).values([
    { id: ORG, name: "A", slug: "a", createdAt: now },
    { id: "org-b", name: "B", slug: "b", createdAt: now },
  ]);
  afterAll(() => sandbox.postgres.close());

  const row = (id: string) =>
    db.query.artifacts.findFirst({ where: eq(artifacts.id, id) });
  const head = (id: string) => repos.commits(chat.artifactRepoId(id)).at(-1);

  describe("artifacts", () => {
    test("a new artifact is the first commit of its own repository", async () => {
      const saved = await chat.createArtifact(writer, REPORT);
      const stored = await row(saved.id);
      const commit = head(saved.id);
      expect(stored?.headSha).toBe(commit?.sha);
      expect(stored?.currentVersion).toBe(1);
      expect(commit?.author).toBe("Notra agent");
      const file = commit?.files.get("artifact.md") ?? "";
      expect(file).toStartWith("---\ntitle: Weekly AI traffic\n");
      // The agent reads exactly the file git holds.
      const read = await chat.readArtifactForModel(ORG, saved.id);
      expect(read).toEqual({ artifactId: saved.id, version: 1, content: file });
    });

    test("an update builds on the version the writer read", async () => {
      const saved = await chat.createArtifact(writer, REPORT);
      const next = { ...REPORT, title: "AI traffic, week 46" };
      const updated = await chat.updateArtifact(writer, saved.id, next, 1);
      expect(updated.version).toBe(2);
      expect(repos.commits(chat.artifactRepoId(saved.id))).toHaveLength(2);
      const revisions = await db.query.artifactRevisions.findMany({
        where: eq(artifactRevisions.artifactId, saved.id),
      });
      expect(revisions.map((revision) => revision.sha)).toEqual(
        repos.commits(chat.artifactRepoId(saved.id)).map((commit) => commit.sha)
      );

      // A writer that read version 1 can't overwrite version 2.
      await expect(
        chat.updateArtifact(writer, saved.id, REPORT, 1)
      ).rejects.toBeInstanceOf(chat.ArtifactConflictError);
      expect(repos.commits(chat.artifactRepoId(saved.id))).toHaveLength(2);

      // Saving the same content again adds no version.
      const same = await chat.updateArtifact(writer, saved.id, next, 2);
      expect(same.version).toBe(2);
      expect(same.warnings.at(-1)).toContain("Nothing changed");
      expect(repos.commits(chat.artifactRepoId(saved.id))).toHaveLength(2);
    });

    test("a commit whose row update was lost is adopted, not overwritten", async () => {
      const saved = await chat.createArtifact(writer, REPORT);
      const repoId = chat.artifactRepoId(saved.id);
      // Another writer committed, then its database write was lost.
      const lost = await repos.commit(repoId, {
        expectedHeadSha: head(saved.id)?.sha ?? "",
        message: "Lost",
        author: { name: "Notra agent", email: "agent@usenotra.com" },
        files: {
          "artifact.md": "---\ntitle: Written elsewhere\n---\n\nKept.\n",
        },
      });
      const edit = { ...REPORT, title: "Edited" };
      await expect(
        chat.updateArtifact(writer, saved.id, edit, 1)
      ).rejects.toMatchObject({ currentVersion: 2 });
      const stored = await row(saved.id);
      expect(stored?.headSha).toBe(lost);
      expect(stored?.title).toBe("Written elsewhere");
      // With the row caught up, a write based on version 2 lands.
      const updated = await chat.updateArtifact(writer, saved.id, edit, 2);
      expect(updated.version).toBe(3);
      const revisions = await db.query.artifactRevisions.findMany({
        where: eq(artifactRevisions.artifactId, saved.id),
      });
      expect(revisions.map((revision) => revision.actor)).toEqual([
        "chat",
        "recovered",
        "chat",
      ]);
    });

    test("a write another writer's conflict already adopted counts as saved", async () => {
      const saved = await chat.createArtifact(writer, REPORT);
      // Between our commit and our row update, a conflicting writer catches
      // the row up to our commit.
      hooks.afterCommit = async (_repoId, sha) => {
        hooks.afterCommit = undefined;
        await db
          .update(artifacts)
          .set({ headSha: sha, currentVersion: 2 })
          .where(eq(artifacts.id, saved.id));
      };
      const updated = await chat.updateArtifact(
        writer,
        saved.id,
        { ...REPORT, title: "Mine" },
        1
      );
      expect(updated.version).toBe(2);
    });

    test("old versions come from git, and restoring one adds a version", async () => {
      const saved = await chat.createArtifact(writer, REPORT);
      await chat.updateArtifact(
        writer,
        saved.id,
        { ...REPORT, blocks: [{ type: "text", markdown: "Rewritten." }] },
        1
      );
      const first = await chat.readArtifact(ORG, saved.id, 1);
      expect(first?.content.blocks).toEqual(REPORT.blocks);
      expect(first?.versions.map((entry) => entry.version)).toEqual([2, 1]);

      const restored = await chat.restoreArtifactVersion({
        organizationId: ORG,
        artifactId: saved.id,
        version: 1,
        userId: "user-a",
      });
      expect(restored.version).toBe(3);
      expect((await row(saved.id))?.content.blocks).toEqual(REPORT.blocks);
      expect(head(saved.id)?.author).toBe("Workspace member");
      const revision = await db.query.artifactRevisions.findFirst({
        where: and(
          eq(artifactRevisions.artifactId, saved.id),
          eq(artifactRevisions.version, 3)
        ),
      });
      expect(revision).toMatchObject({ actor: "member", userId: "user-a" });
    });

    test("a public link shows the version it was published at", async () => {
      const saved = await chat.createArtifact(writer, REPORT);
      const shared = await setArtifactShared(ORG, saved.id, true);
      const shareId = shared?.sharePath?.split("/").at(-1) ?? "";
      await chat.updateArtifact(
        writer,
        saved.id,
        { ...REPORT, title: "Internal numbers" },
        1
      );
      expect((await chat.readSharedArtifact(shareId))?.content.title).toBe(
        "Weekly AI traffic"
      );
      // Publishing again keeps the link and moves it to the latest version.
      const republished = await setArtifactShared(ORG, saved.id, true);
      expect(republished).toEqual({
        sharePath: shared?.sharePath ?? null,
        shareVersion: 2,
      });
      expect((await chat.readSharedArtifact(shareId))?.content.title).toBe(
        "Internal numbers"
      );
      await setArtifactShared(ORG, saved.id, false);
      expect(await chat.readSharedArtifact(shareId)).toBeNull();
    });

    test("deleting an artifact deletes its repository, now or on retry", async () => {
      const saved = await chat.createArtifact(writer, REPORT);
      const repoId = chat.artifactRepoId(saved.id);
      expect(await deleteArtifact(ORG, saved.id)).toBe(true);
      expect(repos.repoIds()).not.toContain(repoId);
      expect(await db.select().from(codeStorageDeletions)).toEqual([]);

      const other = await chat.createArtifact(writer, REPORT);
      const otherRepo = chat.artifactRepoId(other.id);
      failures.deleteRepo = true;
      await deleteArtifact(ORG, other.id);
      expect(repos.repoIds()).toContain(otherRepo);
      const queued = await db.select().from(codeStorageDeletions);
      expect(queued.map((entry) => entry.repoId)).toEqual([otherRepo]);
      expect(
        (
          await cleanupCodeStorageRepos(
            new Date(),
            new AbortController().signal
          )
        ).failed
      ).toBe(1);

      failures.deleteRepo = false;
      expect(
        (
          await cleanupCodeStorageRepos(
            new Date(Date.now() + 600_000),
            new AbortController().signal
          )
        ).failed
      ).toBe(0);
      expect(repos.repoIds()).not.toContain(otherRepo);
      expect(await db.select().from(codeStorageDeletions)).toEqual([]);
    });

    test("a repository whose row never lands is deleted after the grace period", async () => {
      const before = new Set(repos.repoIds());
      await expect(
        chat.createArtifact({ ...writer, userId: "no-such-user" }, REPORT)
      ).rejects.toThrow();
      const orphan =
        repos.repoIds().find((repoId) => !before.has(repoId)) ?? "";
      expect(orphan).toStartWith("notra-artifact-");
      const signal = new AbortController().signal;
      // In-flight creates get time to land before anything is deleted.
      await cleanupCodeStorageRepos(new Date(), signal);
      expect(repos.repoIds()).toContain(orphan);
      await cleanupCodeStorageRepos(new Date(Date.now() + 3_700_000), signal);
      expect(repos.repoIds()).not.toContain(orphan);
      expect(await db.select().from(codeStorageDeletions)).toEqual([]);
    });

    test("rows the previous app inserted mid-deploy stay hidden", async () => {
      await db.insert(artifacts).values({
        id: "legacy-row",
        organizationId: ORG,
        source: "chat",
        title: "Made by the old app",
      });
      expect(await chat.findArtifact(ORG, "legacy-row")).toBeUndefined();
      const { artifacts: listed } = await artifactToolHandlers(writer).list({
        query: "old app",
      });
      expect(listed).toEqual([]);
    });

    test("deleting a workspace queues every artifact repository", async () => {
      const saved = await chat.createArtifact(
        { organizationId: "org-b", source: "slack" },
        REPORT
      );
      await db.delete(organizations).where(eq(organizations.id, "org-b"));
      const queued = await db.select().from(codeStorageDeletions);
      expect(queued.map((entry) => entry.repoId)).toContain(
        chat.artifactRepoId(saved.id)
      );
      await cleanupCodeStorageRepos(new Date(), new AbortController().signal);
      expect(repos.repoIds()).not.toContain(chat.artifactRepoId(saved.id));
    });

    test("agents can't edit a daily brief", async () => {
      const brief = await chat.createArtifact(
        { organizationId: ORG, source: "autopilot" },
        REPORT
      );
      await expect(
        chat.updateArtifact(writer, brief.id, REPORT)
      ).rejects.toBeInstanceOf(chat.ArtifactReadOnlyError);
    });

    test("a brief without an artifact gets one, once, with its day and Slack thread", async () => {
      const briefDay = new Date("2026-11-01T09:00:00Z");
      const content = {
        headline: "Two calls to make today",
        summary: "One pull request is ready.",
        sections: [
          { title: "Pricing", body: "The FAQ answers it.", findingIds: [] },
        ],
        findingIds: [],
        mergedIds: [],
        insights: ["ChatGPT cited the docs twice."],
        writtenBy: "agent" as const,
      };
      // An older brief, or one whose artifact the previous app saved mid-deploy.
      await db.insert(artifacts).values({
        id: "legacy-brief",
        organizationId: ORG,
        source: "autopilot",
        title: "Old",
      });
      await db.insert(autopilotBriefs).values({
        id: "brief-a",
        organizationId: ORG,
        content,
        artifactId: "legacy-brief",
        slackTeamId: "T1",
        slackChannelId: "C1",
        slackMessageTs: "1.2",
        createdAt: briefDay,
      });
      const brief = {
        id: "brief-a",
        content,
        createdAt: briefDay,
        artifactId: null,
      };
      const saved = await ensureBriefArtifact(ORG, brief, {
        replaces: "legacy-brief",
      });
      expect(saved.artifactId).toBeString();
      // A second visit opens the same artifact.
      const again = await ensureBriefArtifact(ORG, saved);
      expect(again.artifactId).toBe(saved.artifactId);
      const view = await loadArtifactView({
        organizationId: ORG,
        artifactId: saved.artifactId ?? "",
        role: "owner",
      });
      expect(view?.source).toBe("autopilot");
      expect(view?.title).toBe("Two calls to make today");
      // An older brief opened today still reads as its own day.
      expect(view?.versionCreatedAt).toEqual(briefDay);
      expect(view?.slackUrl).toBe(
        "https://app.slack.com/client/T1/C1/thread/C1-1.2"
      );
      // Without Autopilot on the plan the brief is gone, like its /brief link.
      gate.on = false;
      try {
        expect(
          await loadArtifactView({
            organizationId: ORG,
            artifactId: saved.artifactId ?? "",
            role: "owner",
          })
        ).toBeNull();
      } finally {
        gate.on = true;
      }
    });

    test("the tools take a file and name the line of every problem", async () => {
      const tools = artifactToolHandlers(writer);
      const error = await tools
        .create({
          content:
            '---\ntitle: Broken\n---\n\nIntro.\n\n```callout\n{"tone":"loud","text":"x"}\n```\n',
        })
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(chat.ArtifactFileError);
      expect((error as Error).message).toContain("Line 7:");

      const created = await tools.create({
        content: "---\ntitle: Pricing questions\n---\n\nWhat people ask.\n",
      });
      const file = await tools.get({ artifactId: created.artifact.id });
      const updated = await tools.update({
        artifactId: created.artifact.id,
        version: file.version,
        content: file.content.replace("What people ask.", "What they ask."),
      });
      expect(updated.artifact.version).toBe(2);
      const { artifacts: found } = await tools.list({ query: "pricing" });
      expect(found.map((entry) => entry.id)).toEqual([created.artifact.id]);
    });
  });
}
