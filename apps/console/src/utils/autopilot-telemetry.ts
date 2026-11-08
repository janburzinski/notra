import { AUTOPILOT_AGENT_STEP_EVENT_KIND } from "@notra/db/constants/autopilot";

import {
  AUTOPILOT_AGENT_PROMPT_MESSAGE,
  AUTOPILOT_LEGACY_STEP_MESSAGE,
  AUTOPILOT_OPENED_PULL_REQUEST,
  AUTOPILOT_RETRY_MESSAGE,
  AUTOPILOT_RUN_LANE,
  AUTOPILOT_SPAN_DATA_FIELDS,
  AUTOPILOT_STEP_PARENT_SLACK_MS,
  AUTOPILOT_TIMELINE_MAX_TICKS,
  AUTOPILOT_TIMELINE_TICK_STEPS_MS,
  AUTOPILOT_TOOLTIP_MAX_DETAILS,
  AUTOPILOT_TOOLTIP_MAX_VALUE_CHARS,
} from "@/constants/autopilot";
import type {
  AutopilotEventDetail,
  AutopilotLaneTelemetry,
  AutopilotMark,
  AutopilotModelTelemetry,
  AutopilotSpan,
  AutopilotTelemetry,
  AutopilotTraceEvent,
  AutopilotUsageTotals,
} from "@/types/autopilot";

function numberField(data: AutopilotTraceEvent["data"], key: string) {
  const value = data?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringField(data: AutopilotTraceEvent["data"], key: string) {
  const value = data?.[key];
  return typeof value === "string" ? value : null;
}

function stringsField(data: AutopilotTraceEvent["data"], key: string) {
  const value = data?.[key];
  return Array.isArray(value) &&
    value.every((entry) => typeof entry === "string")
    ? value
    : null;
}

function truncate(value: string) {
  return value.length > AUTOPILOT_TOOLTIP_MAX_VALUE_CHARS
    ? `${value.slice(0, AUTOPILOT_TOOLTIP_MAX_VALUE_CHARS - 1)}…`
    : value;
}

function formatDetailValue(
  value: NonNullable<AutopilotTraceEvent["data"]>[string]
) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "number") {
    return value.toLocaleString("en-US");
  }
  if (typeof value === "string") {
    return value.length > 0 ? truncate(value) : null;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return null;
    }
    const [first] = value;
    return value.length === 1 && first
      ? truncate(first)
      : `${value.length} · ${truncate(first ?? "")}`;
  }
  const entries = Object.entries(value);
  return entries.length > 0
    ? truncate(entries.map(([key, count]) => `${key} ${count}`).join(", "))
    : null;
}

/** "alreadyHandled" → "Already handled". */
function detailLabel(key: string) {
  if (key === "url") {
    return "URL";
  }
  const words = key.replaceAll(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** An event's recorded fields as tooltip rows, minus the ones in `skip`. */
function autopilotEventDetails(
  data: AutopilotTraceEvent["data"],
  skip?: ReadonlySet<string>
): AutopilotEventDetail[] {
  const details: AutopilotEventDetail[] = [];
  for (const [key, raw] of Object.entries(data ?? {})) {
    const value = skip?.has(key) ? null : formatDetailValue(raw);
    if (value !== null) {
      details.push({ label: detailLabel(key), value });
    }
  }
  return details.slice(0, AUTOPILOT_TOOLTIP_MAX_DETAILS);
}

export function isAutopilotStepEvent(event: AutopilotTraceEvent) {
  return (
    event.data?.kind === AUTOPILOT_AGENT_STEP_EVENT_KIND ||
    (event.internal && AUTOPILOT_LEGACY_STEP_MESSAGE.test(event.message))
  );
}

/** "1.6 s · 3.1K in · 52 out · readFile" for a step event's row. */
export function describeAutopilotStepEvent(event: AutopilotTraceEvent) {
  if (!isAutopilotStepEvent(event)) {
    return null;
  }
  const durationMs = numberField(event.data, "durationMs");
  const inputTokens = numberField(event.data, "inputTokens");
  const cachedInputTokens = numberField(event.data, "cachedInputTokens");
  const outputTokens = numberField(event.data, "outputTokens");
  const tools = stringsField(event.data, "tools");
  const finishReason = stringField(event.data, "finishReason");
  const parts = [
    durationMs === null ? null : formatAutopilotMs(durationMs),
    inputTokens === null ? null : `${formatAutopilotTokens(inputTokens)} in`,
    cachedInputTokens
      ? `${formatAutopilotTokens(cachedInputTokens)} cached`
      : null,
    outputTokens === null ? null : `${formatAutopilotTokens(outputTokens)} out`,
    tools && tools.length > 0 ? tools.join(", ") : null,
    finishReason && finishReason !== "tool-calls"
      ? `finished: ${finishReason}`
      : null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** A model call logs its model and how long it took, after it returned. */
function isModelCallEvent(event: AutopilotTraceEvent) {
  return (
    !isAutopilotStepEvent(event) &&
    stringField(event.data, "model") !== null &&
    numberField(event.data, "durationMs") !== null
  );
}

function emptyTotals(): AutopilotUsageTotals {
  return {
    calls: 0,
    steps: 0,
    toolCalls: null,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    modelTimeMs: 0,
  };
}

/**
 * Tokens come from calls only: an agent's call already totals its steps, and
 * other events (the repository agent's phase note) carry running sums.
 */
function addSpan(totals: AutopilotUsageTotals, span: AutopilotSpan) {
  if (span.kind === "step") {
    totals.steps += 1;
    totals.cachedInputTokens += span.cachedInputTokens ?? 0;
    if (span.tools) {
      totals.toolCalls = (totals.toolCalls ?? 0) + span.tools.length;
    }
    return;
  }
  totals.calls += 1;
  totals.inputTokens += span.inputTokens ?? 0;
  totals.outputTokens += span.outputTokens ?? 0;
  totals.modelTimeMs += span.endMs - span.startMs;
}

/** Turns a run's flat event log into spans per job, for the waterfall. */
export function buildAutopilotTelemetry(
  events: AutopilotTraceEvent[]
): AutopilotTelemetry {
  const spans: AutopilotSpan[] = [];
  const marks: AutopilotMark[] = [];
  /** Where the next legacy step in a lane started: its prompt or last step. */
  const legacyStepStart = new Map<string, number>();
  for (const event of events) {
    const lane = event.job ?? AUTOPILOT_RUN_LANE;
    const at = new Date(event.createdAt).getTime();
    const data = event.data;
    if (isAutopilotStepEvent(event)) {
      const durationMs = numberField(data, "durationMs");
      const step =
        numberField(data, "step") ??
        Number(AUTOPILOT_LEGACY_STEP_MESSAGE.exec(event.message)?.[1] ?? 0);
      spans.push({
        id: `${event.id}:step`,
        eventId: event.id,
        lane,
        kind: "step",
        label: `Step ${step}`,
        model: stringField(data, "model"),
        startMs:
          durationMs === null
            ? (legacyStepStart.get(lane) ?? at)
            : at - durationMs,
        endMs: at,
        inputTokens: numberField(data, "inputTokens"),
        outputTokens: numberField(data, "outputTokens"),
        cachedInputTokens: numberField(data, "cachedInputTokens"),
        reasoningTokens: numberField(data, "reasoningTokens"),
        steps: null,
        tools: stringsField(data, "tools"),
        finishReason: stringField(data, "finishReason"),
        loopSteps: null,
        details: autopilotEventDetails(data, AUTOPILOT_SPAN_DATA_FIELDS),
      });
      legacyStepStart.set(lane, at);
      continue;
    }
    if (event.internal && AUTOPILOT_AGENT_PROMPT_MESSAGE.test(event.message)) {
      legacyStepStart.set(lane, at);
      continue;
    }
    // Retries logged before they carried a model and duration still hold the
    // failed attempt's tokens; they become zero-length calls.
    const retryModel = AUTOPILOT_RETRY_MESSAGE.exec(event.message)?.[1] ?? null;
    if (isModelCallEvent(event) || retryModel !== null) {
      const steps = numberField(data, "steps");
      spans.push({
        id: `${event.id}:call`,
        eventId: event.id,
        lane,
        kind: steps === null ? "model" : "agent",
        label: event.message,
        model: stringField(data, "model") ?? retryModel,
        startMs: at - (numberField(data, "durationMs") ?? 0),
        endMs: at,
        inputTokens: numberField(data, "inputTokens"),
        outputTokens: numberField(data, "outputTokens"),
        cachedInputTokens: numberField(data, "cachedInputTokens"),
        reasoningTokens: numberField(data, "reasoningTokens"),
        steps,
        tools: null,
        finishReason: stringField(data, "finishReason"),
        loopSteps: null,
        details: autopilotEventDetails(data, AUTOPILOT_SPAN_DATA_FIELDS),
      });
      continue;
    }
    if (event.internal) {
      continue;
    }
    marks.push({
      eventId: event.id,
      lane,
      atMs: at,
      level: event.level,
      label: event.message,
      minor: event.level === "info",
      details: autopilotEventDetails(data),
    });
  }

  // A step belongs to the loop in its job whose run covers the step's end.
  const loops = spans.filter((span) => span.kind === "agent");
  for (const span of spans) {
    if (span.kind !== "step") {
      continue;
    }
    const loop = loops.find(
      (candidate) =>
        candidate.lane === span.lane &&
        candidate.startMs <= span.endMs &&
        span.endMs <= candidate.endMs + AUTOPILOT_STEP_PARENT_SLACK_MS
    );
    span.loopSteps = loop?.steps ?? null;
  }

  const times = [
    ...spans.flatMap((span) => [span.startMs, span.endMs]),
    ...marks.map((mark) => mark.atMs),
  ];
  const originMs = times.length > 0 ? Math.min(...times) : 0;
  const endMs = times.length > 0 ? Math.max(...times) : 0;

  const lanes = new Map<string, AutopilotLaneTelemetry>();
  const lane = (key: string, at: number) => {
    const existing = lanes.get(key);
    if (existing) {
      existing.startMs = Math.min(existing.startMs, at);
      existing.endMs = Math.max(existing.endMs, at);
      return existing;
    }
    const created = {
      ...emptyTotals(),
      lane: key,
      startMs: at,
      endMs: at,
      errors: 0,
      pullRequests: 0,
    };
    lanes.set(key, created);
    return created;
  };
  const models = new Map<string, AutopilotModelTelemetry>();
  const totals = { ...emptyTotals(), errors: 0, retries: 0 };
  for (const span of spans) {
    const row = lane(span.lane, span.startMs);
    lane(span.lane, span.endMs);
    addSpan(row, span);
    addSpan(totals, span);
    if (AUTOPILOT_RETRY_MESSAGE.test(span.label)) {
      totals.retries += 1;
    }
    if (span.model) {
      const model = models.get(span.model) ?? {
        ...emptyTotals(),
        model: span.model,
      };
      addSpan(model, span);
      models.set(span.model, model);
    }
  }
  for (const mark of marks) {
    const row = lane(mark.lane, mark.atMs);
    if (mark.level === "error") {
      row.errors += 1;
      totals.errors += 1;
    }
    if (AUTOPILOT_OPENED_PULL_REQUEST.test(mark.label)) {
      row.pullRequests += 1;
    }
  }

  return {
    originMs,
    endMs,
    totals,
    // Jobs in the order they started; run-level work (planner, brief) last.
    lanes: [...lanes.values()].sort(
      (a, b) =>
        Number(a.lane === AUTOPILOT_RUN_LANE) -
          Number(b.lane === AUTOPILOT_RUN_LANE) || a.startMs - b.startMs
    ),
    models: [...models.values()].sort(
      (a, b) =>
        b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens)
    ),
    spans,
    marks,
  };
}

/**
 * Packs overlapping spans into as few rows as possible, in start order. Calls
 * in one job run concurrently (fact checks), so one row would hide them.
 */
export function packAutopilotSpans(spans: AutopilotSpan[]) {
  const rows: AutopilotSpan[][] = [];
  for (const span of [...spans].sort((a, b) => a.startMs - b.startMs)) {
    const row = rows.find((candidate) => {
      const last = candidate.at(-1);
      return last !== undefined && last.endMs <= span.startMs;
    });
    if (row) {
      row.push(span);
    } else {
      rows.push([span]);
    }
  }
  return rows;
}

export function autopilotTimelineTicks(totalMs: number) {
  const step =
    AUTOPILOT_TIMELINE_TICK_STEPS_MS.find(
      (candidate) => totalMs / candidate <= AUTOPILOT_TIMELINE_MAX_TICKS
    ) ?? AUTOPILOT_TIMELINE_TICK_STEPS_MS.at(-1);
  if (!step || totalMs <= 0) {
    return [0];
  }
  const ticks: number[] = [];
  for (let at = 0; at <= totalMs; at += step) {
    ticks.push(at);
  }
  return ticks;
}

export function formatAutopilotMs(ms: number) {
  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} s`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

/** A point in the run, to a tenth of a second: "12.4 s", "1m 13.2s". */
export function formatAutopilotOffset(ms: number) {
  const seconds = Math.max(0, ms) / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`;
  }
  return `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(1)}s`;
}

/** Axis labels: 0, 30s, 1m, 1m 30s. */
export function formatAutopilotTick(ms: number) {
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes === 0) {
    return seconds === 0 ? "0" : `${seconds}s`;
  }
  return seconds % 60 === 0 ? `${minutes}m` : `${minutes}m ${seconds % 60}s`;
}

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatAutopilotTokens(value: number | null) {
  return value === null ? "–" : compactNumber.format(value);
}
