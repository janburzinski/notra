import { AUTOPILOT_ACTION_MIN_CONFIDENCE } from "@notra/ai/constants/autopilot-planner";

import type {
  AutopilotFindingLink,
  AutopilotFindingView,
  AutopilotInlineSegment,
  AutopilotPendingFindingAction,
  AutopilotSourceBlock,
} from "@/types/autopilot";
import { formatAutopilotPercent as percent } from "@/utils/autopilot-events";

const BLOG_TITLE_PREFIX = /^Blog post(?: for |: )/i;
const WRAPPING_QUOTES = /^"(.*)"$/;
const BRIEF_SOURCE_LINE = /^Based on [^\n]*\n+/;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const MARKDOWN_IMAGE = /!\[[^\]]*\]\([^)]*\)/g;
const GENERATED_FOOTER = /(?:🤖\s*)?Generated with \[[^\]]*\]\([^)]*\)/g;
const EXTRA_BLANK_LINES = /\n{3,}/g;
const MARKDOWN_HEADING = /^#{1,6}\s+(.*)$/;
const MARKDOWN_BULLET = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ x]\]\s+)?(.*)$/i;
const MARKDOWN_FENCE = /^\s*(```|~~~)/;
const MARKDOWN_BOLD = /\*\*|__/g;
const MARKDOWN_LINK = /\[([^\]]+)\]\([^)]*\)/g;

/** The title without the "Blog post:" prefix the table and Slack already imply. */
export function findingDisplayTitle(
  finding: Pick<AutopilotFindingView, "title">
) {
  return finding.title
    .replace(BLOG_TITLE_PREFIX, "")
    .replace(WRAPPING_QUOTES, "$1");
}

/** Has a pull request, or is being written into one by a run. */
function isPullRequestFinding(finding: AutopilotFindingView) {
  return (
    finding.pullRequestNumber !== null ||
    (finding.status === "open" && !finding.evidence.brief)
  );
}

/** Worth a post but not sure enough for a pull request, or being written from a click. */
export function isIdeaFinding(finding: AutopilotFindingView) {
  return (
    finding.status === "suggested" ||
    (finding.status === "open" && Boolean(finding.evidence.brief))
  );
}

/** Everything the pull requests tab lists: drafts and writes that failed. */
export function isListedPullRequest(finding: AutopilotFindingView) {
  return (
    (isPullRequestFinding(finding) || finding.status === "failed") &&
    !isIdeaFinding(finding)
  );
}

/**
 * Why Autopilot wrote this, or why it is still an idea, in one or two
 * sentences. `formatDate` keeps locale formatting with the caller.
 */
export function describeFindingReason(
  finding: AutopilotFindingView,
  formatDate: (date: Date) => string
) {
  if (finding.kind === "readiness") {
    return "Fixes website issues found by the readiness scan.";
  }
  const { citations, rendering, comparison, links } = finding.evidence;
  if (finding.kind === "refresh" && citations) {
    return `AI answers cited this page ${percent(citations.before)} of the time a month ago and ${percent(citations.now)} now.`;
  }
  if (finding.kind === "rendering" && rendering) {
    return `AI crawlers get ${rendering.rawWords} of the ${rendering.renderedWords} words a browser shows on this page.`;
  }
  if (finding.kind === "links" && links?.length) {
    const pages = new Set(links.map((link) => link.targetUrl)).size;
    return `${links.length} places in your posts mention searches that ${pages === 1 ? "a page ranks" : `${pages} pages rank`} 4 to 20 for in Google.`;
  }
  if (finding.kind === "comparisons" && comparison) {
    return `AI answers to ${comparison.prompts.length} comparison questions name ${comparison.competitor} and not you.`;
  }
  const confidence = finding.evidence.confidence;
  const threshold =
    finding.evidence.decision?.threshold ?? AUTOPILOT_ACTION_MIN_CONFIDENCE;
  if (confidence === null || confidence === undefined) {
    return "Requested on GitHub.";
  }
  const topic = finding.evidence.topic;
  if (finding.status === "suggested") {
    return topic
      ? "Ready, but there is no room for an automatic pull request. It waits for a click."
      : "Offered on GitHub. It waits for a reply or a click.";
  }
  if (finding.evidence.autoWritten) {
    // Older ideas wrote themselves when nobody dismissed them.
    return `Written automatically: the idea from ${formatDate(new Date(finding.createdAt))} was not dismissed.`;
  }
  if (topic && confidence >= threshold) {
    return `${topic.signals} related signals and ${percent(confidence)} confidence in this post.`;
  }
  if (confidence >= threshold) {
    return `Above the ${percent(threshold)} confidence threshold for a pull request.`;
  }
  return "Written on request from an idea.";
}

/**
 * The source text an idea's post is written from, without the "Based on"
 * line, template comments, images and agent footers.
 */
export function ideaSourceExcerpt(finding: AutopilotFindingView) {
  const text = finding.evidence.brief?.evidence;
  if (!text) {
    return null;
  }
  const excerpt = text
    .replace(BRIEF_SOURCE_LINE, "")
    .replace(HTML_COMMENT, "")
    .replace(MARKDOWN_IMAGE, "")
    .replace(GENERATED_FOOTER, "")
    .replace(MARKDOWN_BOLD, "")
    .replace(MARKDOWN_LINK, "$1")
    .replace(EXTRA_BLANK_LINES, "\n\n")
    .trim();
  return excerpt && excerpt !== finding.evidence.detail ? excerpt : null;
}

/**
 * A pull request body as headings, paragraphs and lists, so the idea page can
 * lay it out without rendering untrusted markdown as HTML.
 */
export function parseSourceBlocks(text: string): AutopilotSourceBlock[] {
  const blocks: AutopilotSourceBlock[] = [];
  let paragraph: { line: number; lines: string[] } | null = null;
  let fence: { line: number; marker: string; lines: string[] } | null = null;
  const flush = () => {
    if (paragraph) {
      blocks.push({
        type: "paragraph",
        line: paragraph.line,
        text: paragraph.lines.join(" "),
      });
      paragraph = null;
    }
  };
  for (const [line, raw] of text.split("\n").entries()) {
    const marker = raw.match(MARKDOWN_FENCE)?.[1];
    if (fence) {
      if (marker === fence.marker) {
        blocks.push({
          type: "code",
          line: fence.line,
          text: fence.lines.join("\n"),
        });
        fence = null;
      } else {
        fence.lines.push(raw);
      }
      continue;
    }
    if (marker) {
      flush();
      fence = { line, marker, lines: [] };
      continue;
    }
    const heading = raw.match(MARKDOWN_HEADING)?.[1]?.trim();
    const bullet = raw.match(MARKDOWN_BULLET)?.[1]?.trim();
    if (heading) {
      flush();
      blocks.push({ type: "heading", line, text: heading });
    } else if (bullet) {
      flush();
      const last = blocks.at(-1);
      if (last?.type === "list") {
        last.items.push({ line, text: bullet });
      } else {
        blocks.push({ type: "list", line, items: [{ line, text: bullet }] });
      }
    } else if (raw.trim()) {
      paragraph ??= { line, lines: [] };
      paragraph.lines.push(raw.trim());
    } else {
      flush();
    }
  }
  flush();
  // A fence the 600-character cut left open still shows as code.
  if (fence?.lines.length) {
    blocks.push({
      type: "code",
      line: fence.line,
      text: fence.lines.join("\n"),
    });
  }
  return blocks;
}

/** Splits on backticks so code spans can be styled without HTML. */
export function splitInlineCode(text: string): AutopilotInlineSegment[] {
  let offset = 0;
  return text.split("`").map((part, index) => {
    const segment = { offset, text: part, code: index % 2 === 1 };
    offset += part.length + 1;
    return segment;
  });
}

/**
 * The merge or dismiss a Slack brief button links to, when the user can do
 * it: merging needs an open pull request, dismissing also takes a suggestion.
 */
export function linkedFindingAction(
  link: AutopilotFindingLink,
  findings: AutopilotFindingView[],
  canManage: boolean
): AutopilotPendingFindingAction | null {
  if (!(canManage && link.finding && link.action)) {
    return null;
  }
  const finding = findings.find((row) => row.id === link.finding);
  if (
    finding?.status === "proposed" ||
    (finding?.status === "suggested" && link.action === "dismiss")
  ) {
    return { kind: link.action, finding };
  }
  return null;
}
