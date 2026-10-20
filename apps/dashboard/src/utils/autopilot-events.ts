import type {
  AutopilotJobKind,
  AutopilotRunEventData,
} from "@notra/db/types/autopilot";

import { AUTOPILOT_EVENT_DATA_LABELS } from "@/constants/autopilot";

const CAMEL_BOUNDARY = /([a-z])([A-Z])/g;
const LOG_INLINE_LIST_MAX = 100;

export function formatAutopilotPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

/** A readable research step, without exposing the raw tool payload. */
export function describeAutopilotToolCall(name: string, input: unknown) {
  const args = (input ?? {}) as { path?: string; url?: string; query?: string };
  if (name === "readFile") {
    return `Read ${args.path}`;
  }
  if (name === "fetchSitemapPage") {
    return `Read ${args.url}`;
  }
  return args.query
    ? `Looked up site pages matching "${args.query}"`
    : "Looked up the site's pages";
}

function formatEventDataLabel(key: string) {
  const label = AUTOPILOT_EVENT_DATA_LABELS[key];
  if (label) {
    return label;
  }
  const words = key.replace(CAMEL_BOUNDARY, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatDuration(ms: number) {
  if (ms < 1000) {
    return `${ms} ms`;
  }
  const seconds = ms / 1000;
  return seconds < 60
    ? `${seconds.toFixed(1)} s`
    : `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
}

function formatEventDataValue(
  key: string,
  value: AutopilotRunEventData[string]
) {
  if (value === null) {
    return "–";
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "None";
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([option, share]) => `${option} ${Math.round(share * 100)}%`)
      .join(", ");
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "number") {
    if (key === "durationMs") {
      return formatDuration(value);
    }
    if (key === "confidence") {
      return `${Math.round(value * 100)}%`;
    }
    return value.toLocaleString();
  }
  return value;
}

/** Sums token counts across every model call recorded for a run. */
export function sumEventTokens(
  events: { data: AutopilotRunEventData | null }[]
) {
  return events.reduce((total, event) => {
    const input = event.data?.inputTokens;
    const output = event.data?.outputTokens;
    return (
      total +
      (typeof input === "number" ? input : 0) +
      (typeof output === "number" ? output : 0)
    );
  }, 0);
}

const LOG_LEVEL_MARKS: Record<string, string> = {
  action: "✓ ",
  error: "✖ ",
};

/** Event fields that only repeat what the line already says. */
const LOG_HIDDEN_FIELDS = new Set(["event"]);

/** Decision details show the work, while the run keeps model and token details. */
export function findingStepLabel(message: string) {
  if (/^Called .+ \(blog-draft\)$/.test(message)) {
    return "Generated a draft";
  }
  if (message === "Rendered the hero image") {
    return "Created the cover image";
  }
  if (message.startsWith("Agent finished with ")) {
    return "Finished the website checks";
  }
  return message;
}

/**
 * The run's events as a build-style log: "HH:MM:SS [job] message", details on
 * indented lines below. Actions read as success, errors as errors.
 */
export function formatRunLog(
  events: {
    job: AutopilotJobKind | null;
    level: string;
    message: string;
    data: AutopilotRunEventData | null;
    createdAt: Date | string;
  }[],
  jobTags: Record<string, string>
) {
  const lines: string[] = [];
  for (const event of events) {
    const time = new Date(event.createdAt).toTimeString().slice(0, 8);
    const tag = jobTags[event.job ?? "run"] ?? "run";
    lines.push(
      `${time} [${tag}] ${LOG_LEVEL_MARKS[event.level] ?? ""}${event.message}`
    );
    for (const [key, value] of Object.entries(event.data ?? {})) {
      if (LOG_HIDDEN_FIELDS.has(key)) {
        continue;
      }
      // Long lists (candidates, what was left out and why) get a line each.
      if (
        Array.isArray(value) &&
        value.join(", ").length > LOG_INLINE_LIST_MAX
      ) {
        lines.push(`    ${formatEventDataLabel(key)}:`);
        lines.push(...value.map((item) => `      · ${item}`));
        continue;
      }
      lines.push(
        `    ${formatEventDataLabel(key)}: ${formatEventDataValue(key, value)}`
      );
    }
  }
  return lines.join("\n");
}
