// Measures what an artifact costs on code.storage: create, update, read and
// delete a throwaway repository, N times. Never point it at the production org.
//   CODE_STORAGE_NAME=… CODE_STORAGE_API_KEY=… bun packages/memory/scripts/repo-latency.ts 10
import { createCodeStorageRepos } from "../src/stores/code-storage-repos";
import { codeStorageCredentials } from "../src/utils/code-storage";

const credentials = codeStorageCredentials();
if (!credentials) {
  throw new Error("Set CODE_STORAGE_NAME and CODE_STORAGE_API_KEY");
}
const store = createCodeStorageRepos(credentials);
const runs = Number(process.argv[2] ?? 5);
const author = { name: "Latency check", email: "bench@usenotra.com" };
const file = `---\ntitle: Latency check\n---\n\n${"A line of report text.\n".repeat(200)}`;
const timings: Record<string, number[]> = {};

async function time<T>(step: string, run: () => Promise<T>) {
  const started = performance.now();
  const result = await run();
  (timings[step] ??= []).push(performance.now() - started);
  return result;
}

for (let index = 0; index < runs; index++) {
  const repoId = `notra-latency-${Date.now()}-${index}`;
  const first = await time("create (repo + commit)", () =>
    store.create(repoId, {
      message: "Create",
      author,
      files: { "artifact.md": file },
    })
  );
  const second = await time("update (commit)", () =>
    store.commit(repoId, {
      expectedHeadSha: first,
      message: "Update",
      author,
      files: { "artifact.md": `${file}One more line.\n` },
    })
  );
  await time("read old version", () =>
    store.read(repoId, "artifact.md", first)
  );
  await time("head", () => store.head(repoId));
  if ((await store.head(repoId)) !== second) {
    throw new Error("head is not the last commit");
  }
  await time("delete", () => store.deleteRepo(repoId));
}

const percentile = (values: number[], share: number) =>
  [...values].sort((a, b) => a - b)[
    Math.min(values.length - 1, Math.floor(values.length * share))
  ] ?? 0;
for (const [step, values] of Object.entries(timings)) {
  console.log(
    `${step.padEnd(24)} p50 ${Math.round(percentile(values, 0.5))} ms  p95 ${Math.round(percentile(values, 0.95))} ms`
  );
}
