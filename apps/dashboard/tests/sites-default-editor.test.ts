import { beforeEach, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { call } from "@orpc/server";

import { site } from "./constants/site-editor";
import type {
  DefaultEditorDraft,
  DefaultEditorSaveDraftInput,
} from "./types/site-editor";

if (process.env.NOTRA_DEFAULT_EDITOR_TEST_WORKER !== "1") {
  test("defaults-first editor and integrations in an isolated process", () => {
    const result = spawnSync(
      process.execPath,
      ["test", fileURLToPath(import.meta.url)],
      {
        env: { ...process.env, NOTRA_DEFAULT_EDITOR_TEST_WORKER: "1" },
        timeout: 30_000,
      }
    );
    expect(result.status, result.stderr?.toString()).toBe(0);
  }, 35_000);
} else {
  let config: string | null = null;
  let draft: DefaultEditorDraft | null = null;
  let writes = 0;
  // Drafts saved after the API's quick check, seen by the publisher's lock.
  let lateDrafts: string[] = [];
  let commits = 0;
  let deploys = 0;
  mock.module("../src/lib/auth/organization", () => ({
    assertAuthenticated: async () => ({
      session: {},
      user: { id: "user-demo" },
    }),
    assertOrganizationAccess: async () => ({
      membership: { role: "owner" },
      user: { id: "user-demo" },
    }),
  }));
  mock.module("../src/lib/sites/access", () => ({
    assertSitesAccess: async () => {},
  }));
  const env = await import("@notra/sites-server/env");
  mock.module("@notra/sites-server/env", () => ({
    ...env,
    isSitesConfigured: () => true,
  }));
  const sites = await import("@notra/sites-server/deployments");
  mock.module("@notra/sites-server/deployments", () => ({
    ...sites,
    getSite: async () => site,
  }));
  const editor = await import("@notra/sites-server/editor");
  mock.module("@notra/sites-server/editor", () => ({
    ...editor,
    listSiteSourceFiles: async () => ({
      commitSha: "a".repeat(40),
      files:
        config === null
          ? []
          : [{ path: "blog.json", sha: "blob-config", size: config.length }],
    }),
    readSiteSourceFile: async () =>
      config === null ? null : { content: config, sha: "blob-config" },
    readPublishedFile: async () =>
      config === null ? null : { content: config, sha: "blob-config" },
    publishSiteDrafts: async (
      _site: unknown,
      input: { assertPublishable?: (paths: readonly string[]) => void }
    ) => {
      input.assertPublishable?.([
        ...(draft ? [draft.path] : []),
        ...lateDrafts,
      ]);
      commits += 1;
      draft = null;
      return { commitSha: "c".repeat(40), pullRequestUrl: null };
    },
    listSiteDrafts: async () => (draft ? [draft] : []),
    listSiteDraftSummaries: async () => (draft ? [draft] : []),
    readSiteDraft: async () => draft,
    saveSiteDraft: async (
      _site: unknown,
      input: DefaultEditorSaveDraftInput
    ) => {
      writes += 1;
      draft = {
        path: "blog.json",
        content: input.content,
        baseBlobSha: input.baseBlobSha,
        baseCommitSha: input.baseCommitSha,
        deleted: false,
        updatedAt: new Date(),
      };
      return draft;
    },
    discardSiteDraft: async () => {
      draft = null;
    },
  }));
  const imageDrafts = await import("@notra/sites-server/image-drafts");
  mock.module("@notra/sites-server/image-drafts", () => ({
    ...imageDrafts,
    listPendingSiteDraftSummaries: async () => (draft ? [draft] : []),
  }));
  mock.module("../src/lib/sites/post-authors", () => ({
    countSiteAuthorUsage: async () => ({}),
    resolvePostAuthorSite: async () => null,
    resolvePostAuthorSites: async () => new Map(),
  }));
  mock.module("../src/lib/sites/deploy-published-commit", () => ({
    deployPublishedCommit: async () => {
      deploys += 1;
      return false;
    },
  }));
  mock.module("../src/lib/workflows/internal-auth", () => ({
    verifyInternalWorkflowRequest: async () => true,
  }));
  const { sitesRouter } = await import("../src/lib/orpc/routers/sites");
  const { POST: sitesAuthorsApi } =
    await import("../src/app/api/internal/sites/authors/route");
  const callAuthorsApi = async (body: Record<string, unknown>) => {
    const response = await sitesAuthorsApi(
      new Request("http://127.0.0.1/api/internal/sites/authors", {
        method: "POST",
        body: JSON.stringify({
          organizationId: site.organizationId,
          siteId: site.id,
          actorUserId: null,
          ...body,
        }),
      })
    );
    return { status: response.status, body: await response.json() };
  };
  const { createORPCContext } = await import("../src/lib/orpc/context");
  const { readSiteIntegrations } =
    await import("@notra/sites-server/integrations");
  const { getSite } = await import("@notra/sites-server/deployments");
  beforeEach(() => {
    config = null;
    draft = null;
    writes = 0;
    lateDrafts = [];
    commits = 0;
    deploys = 0;
  });

  test("missing config appears as a virtual editable file without creating a draft", async () => {
    const context = await createORPCContext({ headers: new Headers() });
    const input = { organizationId: "org-demo", siteId: "site_demo" };
    const files = await call(sitesRouter.editor.files, input, { context });
    expect(files.files).toHaveLength(1);
    expect(files.files[0]).toMatchObject({ path: "blog.json", sha: "" });
    expect(files.drafts).toEqual([]);
    const read = await call(
      sitesRouter.editor.read,
      { ...input, path: "blog.json" },
      { context }
    );
    expect(JSON.parse(read.content)).toMatchObject({
      name: "Default Acme",
      blog: { layout: "grid" },
      changelog: { layout: "timeline" },
    });
    expect(read).toMatchObject({
      published: null,
      blobSha: null,
      publishedBlobSha: null,
      hasDraft: false,
      draftId: null,
      draftRevision: null,
      sourceContext: { productionBranch: "main", rootDirectory: "" },
    });
    expect(writes).toBe(0);
  });
  test("existing valid and invalid config contents are never replaced by defaults", async () => {
    for (const content of ['{"name":"Repository Acme"}', "{invalid", ""]) {
      config = content;
      const context = await createORPCContext({ headers: new Headers() });
      const input = { organizationId: "org-demo", siteId: "site_demo" };
      const files = await call(sitesRouter.editor.files, input, { context });
      expect(files.files[0]?.sha).toBe("blob-config");
      expect(
        (
          await call(
            sitesRouter.editor.read,
            { ...input, path: "blog.json" },
            { context }
          )
        ).content
      ).toBe(content);
    }
    expect(writes).toBe(0);
  });
  test("integrations come from the committed config, never from a config draft", async () => {
    const actualSite = await getSite("site_demo");
    if (!actualSite) {
      throw new Error("Expected test site");
    }
    expect(await readSiteIntegrations(actualSite)).toEqual({
      integrations: {},
      invalid: false,
    });
    draft = {
      path: "blog.json",
      content: JSON.stringify({
        name: "Draft Acme",
        integrations: { plausible: { domain: "draft.example.com" } },
      }),
      baseBlobSha: null,
      baseCommitSha: null,
      deleted: false,
      updatedAt: new Date(),
    };
    config = JSON.stringify({
      name: "Repository Acme",
      integrations: { plausible: { domain: "example.com" } },
    });
    expect(await readSiteIntegrations(actualSite)).toEqual({
      integrations: { plausible: { domain: "example.com" } },
      invalid: false,
    });
    expect(writes).toBe(0);
  });

  test("authors only in a draft are not live while the repository has no blog.json", async () => {
    draft = {
      path: "blog.json",
      content: JSON.stringify({
        name: "Draft Acme",
        authors: { jane: { name: "Jane Doe" } },
      }),
      baseBlobSha: null,
      baseCommitSha: null,
      deleted: false,
      updatedAt: new Date(),
    };
    const listed = await callAuthorsApi({ action: "listAuthors" });
    expect(listed.status).toBe(200);
    expect(listed.body.authors).toEqual([
      expect.objectContaining({ id: "jane", live: false }),
    ]);
    const deleted = await callAuthorsApi({
      action: "deleteAuthor",
      authorId: "jane",
      force: false,
    });
    expect(deleted.status).toBe(200);
    expect(deleted.body.authors).toEqual([]);
    expect(writes).toBe(1);
  });
  test("a file staged while a Design publish runs refuses it instead of going live", async () => {
    config = JSON.stringify({ name: "Repository Acme" });
    draft = {
      path: "blog.json",
      content: JSON.stringify({
        name: "Repository Acme",
        authors: { jane: { name: "Jane Doe" } },
      }),
      baseBlobSha: "blob-config",
      baseCommitSha: null,
      deleted: false,
      updatedAt: new Date(),
    };
    lateDrafts = ["blog/unfinished.mdx"];
    const refused = await callAuthorsApi({ action: "publish" });
    expect(refused).toEqual({
      status: 409,
      body: expect.objectContaining({ code: "SITE_HAS_OTHER_CHANGES" }),
    });
    expect(refused.body.error).toContain("blog/unfinished.mdx");
    expect({ commits, deploys }).toEqual({ commits: 0, deploys: 0 });
    lateDrafts = [];
    const published = await callAuthorsApi({ action: "publish" });
    expect(published).toEqual({
      status: 200,
      body: {
        published: true,
        commitSha: "c".repeat(40),
        deploymentQueued: true,
      },
    });
    expect({ commits, deploys }).toEqual({ commits: 1, deploys: 1 });
    expect(await callAuthorsApi({ action: "publish" })).toEqual({
      status: 200,
      body: { published: false, commitSha: null, deploymentQueued: false },
    });
  });
}
