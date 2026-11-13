import type { AutopilotCopyChange } from "@notra/db/types/autopilot";

import type {
  AutopilotLandingCandidate,
  AutopilotPageCopyChange,
} from "@/types/autopilot-templates-runtime";
import { plainWords } from "@/utils/autopilot-links";

const percent = (value: number) => `${Math.round(value * 100)}%`;

export function landingFingerprint(key: string) {
  return `landing:${key}`;
}

/** Why a landing page's copy changes, in one sentence. */
export function describeLandingSignal(
  candidate: Pick<AutopilotLandingCandidate, "drop" | "queries">
) {
  if (candidate.drop) {
    return `AI answers to its prompts cited it ${percent(candidate.drop.before)} of the time a month ago and ${percent(candidate.drop.now)} now.`;
  }
  const [top] = candidate.queries;
  return top
    ? `Google ranks it ${top.position} for "${top.query}", seen ${top.impressions} times in three months.`
    : "It ranks on page one or two of Google.";
}

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** How many words the copy grows by across changes, never below zero. */
export function addedWords(changes: readonly AutopilotCopyChange[]) {
  return Math.max(
    0,
    changes.reduce(
      (sum, change) => sum + wordCount(change.after) - wordCount(change.before),
      0
    )
  );
}

/** Whether text reads on a page, ignoring case, punctuation and markup. */
function isOnPage(text: string, pageText: string) {
  const words = plainWords(text);
  return words.length > 0 && ` ${plainWords(pageText)} `.includes(` ${words} `);
}

export function isHomepage(url: string) {
  try {
    return new URL(url).pathname.replace(/\/+$/, "") === "";
  } catch {
    return false;
  }
}

/**
 * Whether a file sits in the page's own route: a folder for each part of the
 * path (app/(site)/pricing/page.tsx for /pricing), or a file named for the
 * last part (pages/pricing.tsx).
 */
function isRouteFile(path: string, url: string) {
  let segments: string[];
  try {
    segments = new URL(url).pathname.split("/").filter(Boolean);
  } catch {
    return false;
  }
  const parts = path.split("/");
  const folders = new Set(parts.slice(0, -1));
  const file = (parts.at(-1) ?? "").replace(/\.[^.]+$/, "");
  return segments.every(
    (segment, index) =>
      folders.has(segment) ||
      (index === segments.length - 1 && file === segment)
  );
}

/**
 * Why a copy change doesn't belong to the page, or null when it does. Text
 * must read on the page, and on any page but the homepage it must not also
 * read on the homepage, which would make it a shared component's; metadata
 * there must sit in the page's own route.
 */
export function landingChangeProblem(params: {
  change: AutopilotPageCopyChange;
  url: string;
  pageText: string;
  homeText: string | null;
}) {
  const { change, url, pageText, homeText } = params;
  const home = homeText === null;
  if (change.metadata) {
    return home || isRouteFile(change.path, url)
      ? null
      : `${change.path} isn't in ${url}'s own route, so its title and description would change other pages too. Change the metadata in the page's route files.`;
  }
  if (!isOnPage(change.before, pageText)) {
    return `"${change.before}" isn't on ${url}; change only text this page shows.`;
  }
  if (!home && isOnPage(change.before, homeText)) {
    return `"${change.before}" also shows on the homepage, so ${change.path} is shared with other pages; change only text that ${url} alone renders.`;
  }
  return null;
}

/** One Markdown table row per change, escaped for a pull request body. */
export function copyChangeRows(changes: readonly AutopilotCopyChange[]) {
  const cell = (text: string) => text.replaceAll("|", "\\|") || "(empty)";
  return [
    "| File | Before | After |",
    "| --- | --- | --- |",
    ...changes.map(
      (change) =>
        `| \`${change.path}\` | ${cell(change.before)} | ${cell(change.after)} |`
    ),
  ].join("\n");
}
