import type { StateOfAiSearchReport } from "@/types/state-of-ai-search";

export {
  findSummary,
  latestSummary,
  listLatestSummaries,
  listSummaries,
} from "./summaries";

const REPORT_LOADERS = import.meta.glob<StateOfAiSearchReport>(
  [
    "/src/content/state-of-ai-search/*/*.json",
    "!/src/content/state-of-ai-search/*/*.summary.json",
  ],
  { import: "default" }
);

export async function loadReport(
  slug: string,
  edition: string
): Promise<StateOfAiSearchReport | undefined> {
  const load =
    REPORT_LOADERS[`/src/content/state-of-ai-search/${slug}/${edition}.json`];
  return load ? await load() : undefined;
}
