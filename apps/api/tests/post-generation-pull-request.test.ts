import { describe, expect, test } from "bun:test";

import { createPostGenerationRequestSchema } from "@notra/schemas/api/content";

import { applyPullRequestSelection } from "../src/utils/content-generation";

const pullRequest = { owner: "acme", repo: "app", number: 2385 };

describe("createPostGenerationRequestSchema", () => {
  test("accepts a pull request with a brief", () => {
    const parsed = createPostGenerationRequestSchema.parse({
      contentType: "blog_post",
      pullRequest,
      brief: "  Lead with the phone workflow.  ",
    });

    expect(parsed.pullRequest).toEqual(pullRequest);
    expect(parsed.brief).toBe("Lead with the phone workflow.");
  });

  test("ignores dataPoints for a pull request, even with every flag off", () => {
    const parsed = createPostGenerationRequestSchema.parse({
      contentType: "blog_post",
      pullRequest,
      dataPoints: {
        includePullRequests: false,
        includeCommits: false,
        includeReleases: false,
        includeLinearData: false,
      },
    });
    const body = applyPullRequestSelection(parsed, ["integration_app"]);

    expect(body.dataPoints.includePullRequests).toBe(true);
  });

  test("still rejects every flag off without a pull request, with its code", () => {
    const result = createPostGenerationRequestSchema.safeParse({
      contentType: "blog_post",
      dataPoints: {
        includePullRequests: false,
        includeCommits: false,
        includeReleases: false,
        includeLinearData: false,
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toHaveLength(1);
    expect(result.error?.issues[0]).toMatchObject({
      code: "custom",
      path: ["dataPoints"],
      params: { code: "NO_ACTIVITY_TYPES_SELECTED" },
    });
  });

  test("accepts a brief on its own", () => {
    expect(
      createPostGenerationRequestSchema.safeParse({
        contentType: "changelog",
        brief: "Summarize this week's export work.",
      }).success
    ).toBe(true);
  });

  test("rejects a pull request combined with another source selector", () => {
    for (const selector of [
      { integrations: { github: ["integration_1"] } },
      { integrations: { linear: ["linear_1"] } },
      { github: { repositories: [{ owner: "acme", repo: "app" }] } },
      { repositoryIds: ["integration_1"] },
      { linearIntegrationIds: ["linear_1"] },
      { selectedItems: { commitShas: ["abc123"] } },
    ]) {
      const result = createPostGenerationRequestSchema.safeParse({
        contentType: "blog_post",
        pullRequest,
        ...selector,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(["pullRequest"]);
    }
  });

  test("rejects an empty or oversized brief and a bad pull request number", () => {
    for (const body of [
      { brief: "   " },
      { brief: "x".repeat(4001) },
      { pullRequest: { ...pullRequest, number: 0 } },
      { pullRequest: { owner: "acme", repo: "", number: 1 } },
    ]) {
      expect(
        createPostGenerationRequestSchema.safeParse({
          contentType: "blog_post",
          ...body,
        }).success
      ).toBe(false);
    }
  });
});

describe("applyPullRequestSelection", () => {
  const defaults = {
    includePullRequests: true,
    includeCommits: true,
    includeReleases: true,
    includeLinearData: false,
  };

  test("narrows generation to the one pull request in its repository", () => {
    const body = applyPullRequestSelection(
      { pullRequest, dataPoints: defaults, brief: "keep it short" },
      ["integration_app"]
    );

    expect(body.dataPoints).toEqual({
      includePullRequests: true,
      includeCommits: false,
      includeReleases: false,
      includeLinearData: false,
    });
    expect(body.selectedItems).toEqual({
      pullRequestNumbers: [{ repositoryId: "integration_app", number: 2385 }],
    });
    expect(body.brief).toBe("keep it short");
  });

  test("leaves requests without a pull request alone", () => {
    const body = { dataPoints: defaults };
    expect(applyPullRequestSelection(body, ["integration_app"])).toBe(body);
  });
});
