import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { Site } from "../src/types/sites";
import { startFakeGitHub } from "./utils/fake-github";

if (process.env.NOTRA_INTEGRATION_PR_WORKER !== "1") {
  test("integration saves open pull requests (isolated process)", () => {
    const result = spawnSync(
      process.execPath,
      ["test", fileURLToPath(import.meta.url)],
      {
        env: {
          ...process.env,
          DATABASE_URL: "",
          NOTRA_INTEGRATION_PR_WORKER: "1",
          UPSTASH_REDIS_REST_URL: "",
          UPSTASH_REDIS_REST_TOKEN: "",
        },
        timeout: 30_000,
      }
    );
    expect(
      result.status,
      result.stdout.toString() + result.stderr.toString()
    ).toBe(0);
  }, 35_000);
} else {
  const fake = await startFakeGitHub();
  const octokit = await import("@notra/ai/utils/octokit");
  const originalOctokit = octokit.createOctokit;
  mock.module("@notra/ai/utils/octokit", () => ({
    ...octokit,
    createOctokit: (
      token?: string,
      options?: Parameters<typeof originalOctokit>[1]
    ) => originalOctokit(token, { ...options, baseUrl: fake.url }),
  }));
  const github = await import("../src/github");
  mock.module("../src/github", () => ({
    ...github,
    siteRepositoryAccess: async () => ({
      repository: { owner: "synthetic", repo: "blog" },
      token: "local-fake-token",
    }),
  }));
  const { saveSiteC15tBackend, saveSiteIntegration } =
    await import("../src/integrations");
  const site = {
    id: "site_integrations",
    organizationId: "org_integrations",
    name: "Synthetic",
    productionBranch: "main",
    rootDirectory: "",
  } as Site;
  const committed = (branch: string, path = "blog.json") =>
    fake.state.commits.get(fake.state.branches.get(branch) ?? "")?.get(path);

  beforeEach(() => {
    fake.state.branches = new Map([["main", "initial"]]);
    fake.state.commits = new Map([
      [
        "initial",
        new Map([
          [
            "blog.json",
            `${JSON.stringify(
              {
                name: "Synthetic blog",
                integrations: {
                  umami: { websiteId: "94db1cb1-74f4-4a40-ad6c-962362670409" },
                },
              },
              null,
              2
            )}\n`,
          ],
        ]),
      ],
    ]);
    fake.state.prs = [];
    fake.state.failPR = false;
    fake.state.failAfterPR = false;
    fake.state.prErrorMessage = "";
    fake.state.commitCount = 0;
    fake.state.calls = [];
  });
  afterAll(() => fake.stop());

  test("adding an integration opens a pull request with only blog.json changed", async () => {
    const result = await saveSiteIntegration(site, {
      provider: "databuddy",
      settings: { clientId: " 3ed1fce1-5a56-4cbc-a917-66864f6d18e3 " },
    });
    const [pr, ...others] = fake.state.prs;
    expect(others).toHaveLength(0);
    expect(pr).toMatchObject({
      title: "chore(blog): add Databuddy",
      draft: false,
      base: { ref: "main" },
    });
    expect(pr?.head.ref).toStartWith("notra/integrations-databuddy-");
    expect(result.pullRequestUrl).toBe(pr?.html_url ?? "");
    expect(fake.state.branches.get("main")).toBe("initial");
    const head = fake.state.branches.get(pr?.head.ref ?? "") ?? "";
    expect([...(fake.state.commits.get(head)?.keys() ?? [])]).toEqual([
      "blog.json",
    ]);
    expect(JSON.parse(committed(pr?.head.ref ?? "") ?? "{}")).toEqual({
      name: "Synthetic blog",
      integrations: {
        umami: { websiteId: "94db1cb1-74f4-4a40-ad6c-962362670409" },
        databuddy: { clientId: "3ed1fce1-5a56-4cbc-a917-66864f6d18e3" },
      },
    });
  });

  test("saving the same provider again updates its open pull request", async () => {
    const clientId = "3ed1fce1-5a56-4cbc-a917-66864f6d18e3";
    const first = await saveSiteIntegration(site, {
      provider: "databuddy",
      settings: { clientId },
    });
    const second = await saveSiteIntegration(site, {
      provider: "databuddy",
      settings: { clientId, trackErrors: true },
    });
    expect(fake.state.prs).toHaveLength(1);
    expect(second.pullRequestUrl).toBe(first.pullRequestUrl);
    const [pr] = fake.state.prs;
    expect(
      JSON.parse(committed(pr?.head.ref ?? "") ?? "{}").integrations.databuddy
    ).toEqual({ clientId, trackErrors: true });
    expect(pr?.title).toBe("chore(blog): add Databuddy");
    await saveSiteIntegration(site, { provider: "umami", settings: null });
    expect(fake.state.prs.map((entry) => entry.title)).toEqual([
      "chore(blog): add Databuddy",
      "chore(blog): remove Umami",
    ]);
  });

  test("updating and removing name the change in the pull request title", async () => {
    await saveSiteIntegration(site, {
      provider: "umami",
      settings: {
        websiteId: "94db1cb1-74f4-4a40-ad6c-962362670409",
        hostUrl: "https://stats.example.test",
      },
    });
    expect(fake.state.prs.map((pr) => pr.title)).toEqual([
      "chore(blog): update Umami",
    ]);
    // Removing before that pull request is merged turns it into the removal.
    await saveSiteIntegration(site, { provider: "umami", settings: null });
    expect(fake.state.prs.map((pr) => pr.title)).toEqual([
      "chore(blog): remove Umami",
    ]);
    const removal = fake.state.prs[0]?.head.ref ?? "";
    expect(committed(removal)).toBe('{\n  "name": "Synthetic blog"\n}\n');
  });

  test("a pull request GitHub opened despite a failed response is kept and returned", async () => {
    fake.state.failAfterPR = true;
    const result = await saveSiteIntegration(site, {
      provider: "databuddy",
      settings: { clientId: "3ed1fce1-5a56-4cbc-a917-66864f6d18e3" },
    });
    const [pr] = fake.state.prs;
    expect(result.pullRequestUrl).toBe(pr?.html_url ?? "missing");
    expect(fake.state.branches.has(pr?.head.ref ?? "")).toBe(true);
  });

  test("an unchanged setting opens nothing", async () => {
    expect(
      await saveSiteIntegration(site, {
        provider: "umami",
        settings: { websiteId: " 94db1cb1-74f4-4a40-ad6c-962362670409 " },
      })
    ).toEqual({ pullRequestUrl: null });
    expect(
      await saveSiteIntegration(site, { provider: "ga4", settings: null })
    ).toEqual({ pullRequestUrl: null });
    expect(fake.state.prs).toHaveLength(0);
    expect([...fake.state.branches.keys()]).toEqual(["main"]);
  });

  test("an invalid blog.json opens no pull request", async () => {
    fake.state.commits.get("initial")?.set("blog.json", '{"name":""}');
    await expect(
      saveSiteIntegration(site, {
        provider: "ga4",
        settings: { measurementId: "G-ABC123XYZ9" },
      })
    ).rejects.toThrow("blog.json has errors (name:");
    expect(fake.state.prs).toHaveLength(0);
    expect([...fake.state.branches.keys()]).toEqual(["main"]);
  });

  test("a GitHub failure reports it and deletes the new branch", async () => {
    fake.state.failPR = true;
    await expect(
      saveSiteIntegration(site, {
        provider: "ga4",
        settings: { measurementId: "G-ABC123XYZ9" },
      })
    ).rejects.toThrow("GitHub didn't open the pull request");
    expect([...fake.state.branches.keys()]).toEqual(["main"]);
  });

  test("the c15t backend keeps its other settings", async () => {
    fake.state.commits.get("initial")?.set(
      "blog.json",
      JSON.stringify({
        name: "Synthetic blog",
        integrations: {
          c15t: {
            backendURL: "https://old.inth.app",
            crossSubdomain: true,
          },
        },
      })
    );
    await saveSiteC15tBackend(site, "https://acme.inth.app");
    const [pr] = fake.state.prs;
    expect(pr?.title).toBe("chore(blog): update c15t cookie banner");
    expect(
      JSON.parse(committed(pr?.head.ref ?? "") ?? "{}").integrations
    ).toEqual({
      c15t: { backendURL: "https://acme.inth.app", crossSubdomain: true },
    });
  });
}
