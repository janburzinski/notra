import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("automations only auto-publish changelogs and blog posts, whatever the stored trigger says", () => {
  const schedule = fileURLToPath(
    new URL("../src/lib/workflows/schedule/handlers/index.ts", import.meta.url)
  );
  const event = fileURLToPath(
    new URL("../src/lib/workflows/event/handlers/index.ts", import.meta.url)
  );
  const result = spawnSync(
    process.execPath,
    [
      "--no-env-file",
      "--eval",
      `
import { mock } from "bun:test";
import assert from "node:assert/strict";
const calls = [];
const generator = (type) => async (params) => {
  calls.push({ type, autoPublish: params.autoPublish });
  return { postId: "post-1", title: "Title", posts: [] };
};
mock.module("@notra/ai/agents/changelog", () => ({ generateChangelog: generator("changelog") }));
mock.module("@notra/ai/agents/blog-post", () => ({ generateBlogPost: generator("blog_post") }));
mock.module("@notra/ai/agents/twitter", () => ({ generateTwitterPost: generator("twitter_post") }));
mock.module("@notra/ai/agents/linkedin", () => ({ generateLinkedInPost: generator("linkedin_post") }));
mock.module("@notra/ai/agents/repo-image", () => ({ generateRepoImage: async () => ({ pngBase64: "", html: "", sandbox: null }) }));
mock.module("@notra/ai/utils/image-assets", () => ({ uploadGeneratedImageAsset: async () => "https://image.invalid", uploadGeneratedHtmlAsset: async () => "https://html.invalid" }));
mock.module("@notra/ai/jobs/collection-title", () => ({ maybeGenerateCollectionTitle: async () => {} }));
mock.module("@notra/db/drizzle", () => ({ db: { transaction: async (run) => run({
  insert: () => ({ values: async (row) => { calls.push({ type: "image", autoPublish: row.status === "published" }); } }),
  update: () => ({ set: () => ({ where: async () => {} }) }),
}) } }));
let agent = false;
mock.module("@/lib/agent/flag", () => ({ isAgentContentGenerationEnabled: () => agent }));
mock.module("@/lib/agent/content-task", () => ({ generateContentViaAgentTask: async (params) => {
  calls.push({ type: "agent:" + params.contentType, autoPublish: params.autoPublish });
  return { status: "ok", postId: "post-1", title: "Title", posts: [] };
} }));
const { generateScheduledContent } = await import(${JSON.stringify(schedule)});
const { generateEventBasedContent } = await import(${JSON.stringify(event)});
const ctx = {
  organizationId: "org", userId: "user", collectionId: "collection",
  repositories: [{ integrationId: "repo", owner: "acme", repo: "app", defaultBranch: "main" }],
  tone: "Conversational", promptInput: {}, sourceMetadata: {}, resolveContext: async () => null,
};
const published = async (run) => { calls.length = 0; await run(); return calls.map(({ type, autoPublish }) => [type, autoPublish]); };
const expected = [["changelog", true], ["blog_post", true], ["linkedin_post", false], ["twitter_post", false], ["image", false]];
for (const [type, autoPublish] of expected) {
  const seen = await published(() => generateScheduledContent(type, { ...ctx, autoPublish: true }));
  assert.deepEqual(seen, [[type, autoPublish]], "schedule " + type);
  assert.deepEqual(await published(() => generateScheduledContent(type, { ...ctx, autoPublish: false })), [[type, false]], "schedule draft " + type);
}
const eventCtx = { organizationId: "org", collectionId: "collection", triggerId: "trigger", triggerName: "Trigger", eventType: "release", eventAction: "published", eventData: {}, repositoryId: "repo", repositoryOwner: "acme", repositoryName: "app", tone: "Conversational", brand: {}, sourceMetadata: {}, resolveContext: async () => null };
for (const [type, autoPublish] of expected.slice(0, 4)) {
  assert.deepEqual(await published(() => generateEventBasedContent({ ...eventCtx, outputType: type, autoPublish: true })), [[type, autoPublish]], "event " + type);
}
process.env.NOTRA_AGENT_CONTENT = "1";
agent = true;
assert.deepEqual((await published(() => generateScheduledContent("twitter_post", { ...ctx, autoPublish: true })))[0][1], false, "agent schedule");
assert.deepEqual((await published(() => generateScheduledContent("changelog", { ...ctx, autoPublish: true })))[0][1], true, "agent schedule changelog");
assert.deepEqual((await published(() => generateEventBasedContent({ ...eventCtx, outputType: "linkedin_post", autoPublish: true })))[0][1], false, "agent event");
`,
    ],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      timeout: 30_000,
      encoding: "utf8",
    }
  );
  expect(result.status, result.stderr).toBe(0);
});
