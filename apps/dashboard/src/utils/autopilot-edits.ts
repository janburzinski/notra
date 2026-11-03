import {
  AUTOPILOT_REFRESH_MAX_CHANGED_SHARE,
  AUTOPILOT_REFRESH_MIN_CHANGED_CHARS,
  AUTOPILOT_UPDATED_DATE_KEYS,
} from "@/constants/autopilot-refresh";
import type {
  AutopilotAppliedEdits,
  AutopilotPageEdit,
  AutopilotRefreshProblem,
} from "@/types/autopilot-templates-runtime";
import { mapProse } from "@/utils/autopilot-style";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const HEADING = /^#{1,6}\s+(.+?)\s*#*\s*$/;
const FENCE = /^(?:```|~~~)/;
const URL_PATTERN = /https?:\/\/[^\s)<>"'\]]+/g;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;
const BLANK_RUN = /\n{3,}/g;
const TRAILING_NEWLINES = /\n+$/;

function countOccurrences(haystack: string, needle: string) {
  if (!needle) {
    return 0;
  }
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

/**
 * Applies edits in order, each replacing one exact passage. An edit whose
 * passage is missing or appears more than once is rejected rather than
 * guessed at, so a refresh never lands somewhere the model didn't mean.
 */
export function applyPageEdits(
  original: string,
  edits: readonly AutopilotPageEdit[]
): AutopilotAppliedEdits {
  let content = original;
  const applied: AutopilotPageEdit[] = [];
  const rejected: AutopilotAppliedEdits["rejected"] = [];
  for (const edit of edits) {
    const occurrences = countOccurrences(content, edit.find);
    if (occurrences !== 1) {
      rejected.push({
        edit,
        reason:
          occurrences === 0
            ? "The passage to replace is not in the page"
            : `The passage to replace appears ${occurrences} times`,
      });
      continue;
    }
    if (edit.find === edit.replace) {
      rejected.push({ edit, reason: "The edit changes nothing" });
      continue;
    }
    content = content.replace(edit.find, () => edit.replace);
    applied.push(edit);
  }
  return { content, applied, rejected };
}

/**
 * A cut can leave a run of blank lines or extra ones at the end of the file.
 * The page keeps the spacing it had before; code blocks are left alone.
 */
export function tidyBlankLines(original: string, next: string) {
  const tidy = original.includes("\n\n\n")
    ? next
    : mapProse(next, (prose) => prose.replace(BLANK_RUN, "\n\n"));
  const ending = original.match(TRAILING_NEWLINES)?.[0] ?? "";
  return tidy.replace(TRAILING_NEWLINES, "") + ending;
}

function splitFrontmatter(content: string) {
  const match = FRONTMATTER.exec(content);
  return match
    ? { frontmatter: match[1] ?? "", body: content.slice(match[0].length) }
    : { frontmatter: null, body: content };
}

/** Markdown headings, leaving out "#" lines inside fenced code. */
function headings(body: string) {
  let inFence = false;
  return body.split(/\r?\n/).flatMap((line) => {
    if (FENCE.test(line.trim())) {
      inFence = !inFence;
      return [];
    }
    const heading = inFence ? null : HEADING.exec(line.trim())?.[1];
    return heading ? [heading.toLowerCase()] : [];
  });
}

/** Share of lines that differ, by multiset, relative to the larger version. */
function changedLineShare(before: string, after: string) {
  const left = before.split(/\r?\n/).map((line) => line.trim());
  const right = after.split(/\r?\n/).map((line) => line.trim());
  const remaining = new Map<string, number>();
  for (const line of left) {
    remaining.set(line, (remaining.get(line) ?? 0) + 1);
  }
  let kept = 0;
  for (const line of right) {
    const count = remaining.get(line) ?? 0;
    if (count > 0) {
      kept += 1;
      remaining.set(line, count - 1);
    }
  }
  return 1 - kept / Math.max(left.length, right.length, 1);
}

/** Dates and years, so a change that only moves them doesn't count as an update. */
const DATE_TEXT =
  /\b(?:(?:19|20)\d{2}(?:-\d{2}(?:-\d{2})?)?|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?)/gi;

/**
 * Characters on the lines that actually differ, by multiset, with dates and
 * years taken out first. Unchanged text between two edits never counts.
 */
function changedContentChars(before: string, after: string) {
  const lines = (text: string) =>
    text
      .split(/\r?\n/)
      .map((line) => line.replace(DATE_TEXT, "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
  const remaining = new Map<string, number>();
  for (const line of lines(before)) {
    remaining.set(line, (remaining.get(line) ?? 0) + 1);
  }
  let added = 0;
  for (const line of lines(after)) {
    const count = remaining.get(line) ?? 0;
    if (count > 0) {
      remaining.set(line, count - 1);
    } else {
      added += line.length;
    }
  }
  let removed = 0;
  for (const [line, count] of remaining) {
    removed += line.length * count;
  }
  return Math.max(added, removed);
}

/** Links in the new version that the old one didn't have. */
export function addedLinks(before: string, after: string) {
  const old = new Set(
    (before.match(URL_PATTERN) ?? []).map((url) =>
      url.replace(TRAILING_PUNCTUATION, "")
    )
  );
  return [
    ...new Set(
      (after.match(URL_PATTERN) ?? []).map((url) =>
        url.replace(TRAILING_PUNCTUATION, "")
      )
    ),
  ].filter((url) => !old.has(url));
}

/**
 * Why a refreshed page must not be committed, or null. A refresh keeps the
 * frontmatter, removes headings only through an explicit cut, changes enough
 * to be a real update and not so much that it is a rewrite.
 */
export function refreshProblem(params: {
  original: string;
  next: string;
  applied: readonly AutopilotPageEdit[];
}): AutopilotRefreshProblem {
  const { original, next } = params;
  const before = splitFrontmatter(original);
  const after = splitFrontmatter(next);
  // Dates included: the page's update date is set by code after this check.
  if (before.frontmatter !== after.frontmatter) {
    return "The edits changed the frontmatter";
  }
  const cutSections = params.applied
    .filter((edit) => edit.action === "cut")
    .map((edit) => edit.section.toLowerCase());
  // A heading an update edit took out counts as renamed only when the same
  // edit brought in a new heading in its place, one for one.
  const renamed = new Set(
    params.applied
      .filter((edit) => edit.action === "update")
      .flatMap((edit) => {
        const from = headings(edit.find);
        const to = headings(edit.replace);
        const gone = from.filter((heading) => !to.includes(heading));
        const added = to.filter((heading) => !from.includes(heading));
        return gone.slice(0, added.length);
      })
  );
  const remaining = new Set(headings(after.body));
  const lost = headings(before.body).filter(
    (heading) =>
      !(
        remaining.has(heading) ||
        renamed.has(heading) ||
        cutSections.some((section) => section.includes(heading))
      )
  );
  if (lost.length > 0) {
    return `The edits removed sections without cutting them: ${lost.slice(0, 3).join(", ")}`;
  }
  if (
    changedContentChars(before.body, after.body) <
    AUTOPILOT_REFRESH_MIN_CHANGED_CHARS
  ) {
    return "The edits change too little to be a real update";
  }
  const share = changedLineShare(before.body, after.body);
  if (share > AUTOPILOT_REFRESH_MAX_CHANGED_SHARE) {
    return `The edits change ${Math.round(share * 100)}% of the page, which is a rewrite, not a refresh`;
  }
  return null;
}

/**
 * Sets the page's own "last updated" frontmatter field to today. Only fields
 * the page already has; a page without one gets none.
 */
export function touchUpdatedDate(content: string, today: string) {
  const match = FRONTMATTER.exec(content);
  if (!match) {
    return { content, key: null as string | null };
  }
  const lines = (match[1] ?? "").split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const key = AUTOPILOT_UPDATED_DATE_KEYS.find((candidate) =>
      new RegExp(`^${candidate}\\s*:`).test(line)
    );
    if (!key) {
      continue;
    }
    const value = line.slice(line.indexOf(":") + 1).trim();
    const quote =
      value.startsWith('"') || value.startsWith("'") ? value[0] : "";
    lines[index] = `${key}: ${quote}${today}${quote}`;
    const newline = match[0].includes("\r\n") ? "\r\n" : "\n";
    return {
      content: `---${newline}${lines.join(newline)}${newline}---${newline}${content.slice(match[0].length)}`,
      key: key as string | null,
    };
  }
  return { content, key: null as string | null };
}
