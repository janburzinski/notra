import { AUTOPILOT_BRIEFS_PATH } from "@/constants/autopilot-brief";
import type {
  AutopilotBriefGroups,
  AutopilotBriefSource,
  AutopilotBriefView,
  AutopilotFindingView,
} from "@/types/autopilot";

/** Briefs open outside the dashboard, so the path carries no workspace. */
export function autopilotBriefPath(briefId: string) {
  return `${AUTOPILOT_BRIEFS_PATH}/${encodeURIComponent(briefId)}`;
}

/** Opens a message's thread in Slack (web or the desktop app). */
export function slackThreadUrl(teamId: string, channel: string, ts: string) {
  return `https://app.slack.com/client/${encodeURIComponent(teamId)}/${encodeURIComponent(channel)}/thread/${encodeURIComponent(channel)}-${encodeURIComponent(ts)}`;
}

/** Counts in the order a reader cares about, e.g. "2 ready to merge · 1 idea". */
export function describeBriefCounts(counts: {
  proposed: number;
  suggested: number;
  merged: number;
}) {
  return (
    [
      counts.proposed > 0 ? `${counts.proposed} ready to merge` : null,
      counts.suggested > 0
        ? `${counts.suggested} ${counts.suggested === 1 ? "idea" : "ideas"}`
        : null,
      counts.merged > 0 ? `${counts.merged} merged` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Nothing to review today"
  );
}

/** Still waiting for someone to merge, write or close it. */
export function isFindingPending(finding: { status: string }) {
  return finding.status === "proposed" || finding.status === "suggested";
}

/** What goes before item `index` of a list read aloud: "", ", " or " and ". */
export function listSeparator(index: number, count: number) {
  if (index === 0) {
    return "";
  }
  return index === count - 1 ? " and " : ", ";
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function pagePath(url: string) {
  try {
    const { hostname, pathname } = new URL(url);
    return pathname === "/" ? hostname : pathname;
  } catch {
    return url;
  }
}

/**
 * The evidence an item was built from, as rows a reader can check: the pull
 * requests behind a post, the search or AI answers it targets, the page it
 * changes and what moved there. Only what Autopilot stored, nothing inferred.
 */
export function briefFindingSources(
  finding: Pick<AutopilotFindingView, "kind" | "evidence">
): AutopilotBriefSource[] {
  const { evidence } = finding;
  const sources: AutopilotBriefSource[] = [];
  for (const pull of evidence.pullRequests ?? []) {
    sources.push({
      kind: "pull-request",
      title: pull.title,
      detail: [`#${pull.number}`, pull.author ? `by @${pull.author}` : null]
        .filter(Boolean)
        .join(" · "),
      href: pull.url,
    });
  }
  // The target says where the gap came from; the keyword is set for both.
  const { target } = evidence;
  if (target?.kind === "prompt") {
    const named = evidence.competitors?.slice(0, 3).join(", ") ?? "";
    const share = percent(target.before);
    let detail = named ? `They name ${named}` : null;
    if (evidence.keyword) {
      detail = `AI answers mention you in ${share}${named ? ` and name ${named}` : ""}`;
    }
    sources.push({
      kind: "answers",
      title: evidence.keyword
        ? `"${evidence.keyword}"`
        : `You appear in ${share} of AI answers`,
      detail,
      href: null,
    });
  } else if (evidence.keyword) {
    const position =
      target?.kind === "search" && target.before !== null
        ? `, position ${Math.round(target.before)}`
        : "";
    sources.push({
      kind: "search",
      title: `"${evidence.keyword}"`,
      detail: `Google search${position}`,
      href: evidence.updatePage?.url ?? null,
    });
  }
  if (evidence.comparison) {
    sources.push({
      kind: "answers",
      title: `AI answers name ${evidence.comparison.competitor}, not you`,
      detail: evidence.comparison.prompts[0]
        ? `"${evidence.comparison.prompts[0]}"${evidence.comparison.prompts.length > 1 ? ` and ${evidence.comparison.prompts.length - 1} more` : ""}`
        : null,
      href: null,
    });
  }
  const page = evidence.pageUrl ?? evidence.updatePage?.url ?? null;
  if (page && !evidence.keyword) {
    const { citations, rendering } = evidence;
    let detail: string | null = null;
    if (citations) {
      detail = `Cited in ${percent(citations.before)} of AI answers a month ago, ${percent(citations.now)} now`;
    } else if (rendering) {
      detail = `AI crawlers get ${rendering.rawWords} of ${rendering.renderedWords} words`;
    }
    sources.push({ kind: "page", title: pagePath(page), detail, href: page });
  }
  const instead = evidence.citations?.citedInstead.slice(0, 2) ?? [];
  if (instead.length) {
    sources.push({
      kind: "answers",
      title: "Cited instead",
      detail: instead.join(", "),
      href: null,
    });
  }
  return sources;
}

/**
 * Places a brief's items in reading order: the lead, the model's sections,
 * whatever no section took, then what was merged. Ids whose item is gone
 * are skipped.
 */
export function groupBriefFindings(
  brief: Pick<AutopilotBriefView, "content" | "findings">
): AutopilotBriefGroups {
  const { content } = brief;
  const byId = new Map(brief.findings.map((finding) => [finding.id, finding]));
  const pick = (ids: string[]) =>
    ids.flatMap((id) => {
      const finding = byId.get(id);
      return finding ? [finding] : [];
    });
  const lead = content.lead ? (byId.get(content.lead.findingId) ?? null) : null;
  const placed = new Set([
    ...(lead ? [lead.id] : []),
    ...content.sections.flatMap((section) => section.findingIds),
  ]);
  const unplaced = (finding: AutopilotFindingView) => !placed.has(finding.id);
  return {
    lead,
    sections: content.sections
      .map((section) => ({
        // Each item sits in one section only, so its ids name it.
        key: section.findingIds.join(",") || section.title,
        title: section.title,
        body: section.body,
        rows: pick(section.findingIds),
      }))
      .filter((section) => section.rows.length > 0),
    rest: pick(content.findingIds).filter(unplaced),
    merged: pick(content.mergedIds).filter(unplaced),
    asked: pick(content.findingIds),
  };
}
