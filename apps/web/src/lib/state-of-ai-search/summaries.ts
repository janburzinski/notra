import type { StateOfAiSearchSummary } from "@/types/state-of-ai-search";

const SUMMARY_MODULES = import.meta.glob<StateOfAiSearchSummary>(
  "/src/content/state-of-ai-search/*/*.summary.json",
  { eager: true, import: "default" }
);
const SUMMARIES: StateOfAiSearchSummary[] = Object.values(SUMMARY_MODULES);

export function listSummaries(): StateOfAiSearchSummary[] {
  return SUMMARIES;
}

export function findSummary(
  slug: string,
  edition: string
): StateOfAiSearchSummary | undefined {
  return SUMMARIES.find(
    (summary) => summary.slug === slug && summary.edition === edition
  );
}

export function latestSummary(
  slug: string
): StateOfAiSearchSummary | undefined {
  return SUMMARIES.filter((summary) => summary.slug === slug).toSorted((a, b) =>
    b.edition.localeCompare(a.edition)
  )[0];
}

export function listLatestSummaries(): StateOfAiSearchSummary[] {
  const slugs = [...new Set(SUMMARIES.map((summary) => summary.slug))];
  return slugs.flatMap((slug) => latestSummary(slug) ?? []);
}
