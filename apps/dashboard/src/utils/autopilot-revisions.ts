import {
  AUTOPILOT_REVISION_REQUEST_MARKER,
  AUTOPILOT_REVISION_WORKING_TIMEOUT_MS,
} from "@/constants/autopilot-revisions";
import type { AutopilotRevisionComment } from "@/types/autopilot-revisions";

const REQUEST_HEADER = /^Requested by (.+?) from Notra:\s*/u;
const HTML_COMMENT = /<!--[\s\S]*?-->/gu;

/** The comment a request from Notra posts; the marker tells it apart from replies. */
export function buildRevisionRequestBody(
  requester: string,
  instruction: string
) {
  return `${AUTOPILOT_REVISION_REQUEST_MARKER}\nRequested by ${requester} from Notra:\n\n${instruction.trim()}`;
}

export function parseRevisionComment(
  comment: {
    id: number;
    body: string;
    authorLogin: string;
    createdAt: string;
    htmlUrl: string;
  },
  appLogins: readonly string[]
): AutopilotRevisionComment {
  const isNotra = appLogins.includes(comment.authorLogin.toLowerCase());
  const isRequest =
    isNotra && comment.body.includes(AUTOPILOT_REVISION_REQUEST_MARKER);
  const text = comment.body.replace(HTML_COMMENT, "").trim();
  const header = isRequest ? text.match(REQUEST_HEADER) : null;
  return {
    id: comment.id,
    author: header?.[1] ?? comment.authorLogin.replace(/\[bot\]$/u, ""),
    isNotra,
    isRequest,
    body: header ? text.slice(header[0].length) : text,
    createdAt: comment.createdAt,
    htmlUrl: comment.htmlUrl,
  };
}

/**
 * Requests from Notra that are recent and have no reply from Notra after
 * them, oldest first. The agent answers them in order, so the oldest is the
 * one running.
 */
export function openRevisionRequests(
  comments: readonly AutopilotRevisionComment[],
  now: number
) {
  const lastReply = comments.findLastIndex(
    (comment) => comment.isNotra && !comment.isRequest
  );
  return comments
    .slice(lastReply + 1)
    .filter(
      (comment) =>
        comment.isRequest &&
        now - Date.parse(comment.createdAt) <=
          AUTOPILOT_REVISION_WORKING_TIMEOUT_MS
    );
}

/** A request from Notra is still waiting for the agent's reply. */
export function isRevisionWorking(
  comments: readonly AutopilotRevisionComment[],
  now: number
) {
  return openRevisionRequests(comments, now).length > 0;
}

/** The agent's answer to the latest request, once there is one. */
export function latestRevisionReply(
  comments: readonly AutopilotRevisionComment[]
) {
  const last = comments.findLastIndex((comment) => comment.isRequest);
  if (last === -1) {
    return null;
  }
  return (
    comments
      .slice(last + 1)
      .find((comment) => comment.isNotra && !comment.isRequest) ?? null
  );
}

const REPLY_NOTE_MAX_CHARS = 220;

/** The reply's first paragraph as plain text, short enough for the result card. */
export function summarizeRevisionReply(body: string) {
  const first =
    body
      .split(/\n\s*\n/u)
      .map((part) => part.trim())
      .find((part) => part && !part.startsWith("```")) ?? "";
  const plain = first
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/[*_`>#]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  return plain.length > REPLY_NOTE_MAX_CHARS
    ? `${plain.slice(0, REPLY_NOTE_MAX_CHARS - 1).trimEnd()}…`
    : plain;
}
