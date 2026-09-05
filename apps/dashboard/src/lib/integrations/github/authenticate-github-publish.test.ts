import { describe, expect, mock, test } from "bun:test";

import { authenticateGitHubPublish } from "./authenticate-github-publish";
import { recordGitHubPublishFailure } from "./github-publish-failure-state";
import {
  classifyGitHubPublishFailure,
  GitHubContentPublishError,
} from "./publish-content-to-github";

describe("authenticateGitHubPublish", () => {
  test("pauses only the affected output after three token failures", async () => {
    let failureCount = 0;
    const pauseOutput = mock(() => Promise.resolve(true));
    const redisClient = {
      eval: mock(() => Promise.resolve(++failureCount)),
      del: mock(() => Promise.resolve(1)),
    };
    const target = {
      organizationId: "org-123",
      repositoryId: "repo-123",
      outputId: "output-123",
      outputType: "changelog" as const,
    };
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const error = await authenticateGitHubPublish(() =>
        Promise.resolve(null)
      ).catch((failure: unknown) => failure);
      expect(error).toBeInstanceOf(GitHubContentPublishError);
      const result = await recordGitHubPublishFailure(target, {
        redisClient,
        pauseOutput,
      });
      expect(result.paused).toBe(attempt === 3);
    }
    expect(pauseOutput).toHaveBeenCalledTimes(1);
    expect(pauseOutput).toHaveBeenCalledWith({
      repositoryId: target.repositoryId,
      outputId: target.outputId,
      outputType: target.outputType,
    });
    expect(redisClient.del).toHaveBeenCalledTimes(1);
  });

  test("returns a valid token", async () => {
    expect(
      await authenticateGitHubPublish(() => Promise.resolve("token"))
    ).toBe("token");
  });

  test.each([
    [null, "authentication"],
    [
      Object.assign(new Error("Unauthorized"), { status: 401 }),
      "authentication",
    ],
    [Object.assign(new Error("Not Found"), { status: 404 }), "authentication"],
    [new Error("GitHub App installation not found"), "authentication"],
    [Object.assign(new Error("Rate limit"), { status: 429 }), "rate_limit"],
    [new Error("Connection failed"), "unknown"],
  ] as const)(
    "routes token failure %s through publish failure tracking",
    async (cause, kind) => {
      try {
        await authenticateGitHubPublish(() =>
          cause ? Promise.reject(cause) : Promise.resolve(null)
        );
        throw new Error("Expected authentication to fail");
      } catch (error) {
        expect(error).toBeInstanceOf(GitHubContentPublishError);
        if (error instanceof GitHubContentPublishError) {
          expect(classifyGitHubPublishFailure(error.cause)).toBe(kind);
        }
      }
    }
  );
});
