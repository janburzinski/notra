import type { GeoRouterError } from "@notra/geo-core/geo/errors";

import { AUTOPILOT_WORKFLOW_SCAN_PROMPT_WAIT_MS } from "@/constants/autopilot-workflows";
import type {
  AutopilotPromptScanResult,
  AutopilotPromptScanStart,
} from "@/types/autopilot-workflows";

type PromptScanFailure = Extract<AutopilotPromptScanStart, { ok: false }>;

/**
 * What a prompt scan step does when the scan can't start: stop its branch when
 * another scan holds the project, fail the run on a setting only a person can
 * fix, and retry anything else.
 */
export function describeAutopilotPromptScanFailure(
  failure: GeoRouterError,
  promptId: string
): PromptScanFailure {
  const fail = (reason: string): PromptScanFailure => ({
    ok: false,
    reason,
    outcome: "fail",
  });
  switch (failure._tag) {
    case "GeoScanAlreadyRunningError":
      return {
        ok: false,
        reason:
          "Another scan is running for this project, so the prompt wasn't scanned this time.",
        outcome: "halt",
      };
    case "GeoPromptNotFoundError":
      return fail(
        `No enabled tracked prompt has the id "${promptId}". Pick one from the project's prompts.`
      );
    case "GeoScanEnginesUnknownError":
      return fail(failure.message);
    case "GeoScanEnginesEmptyError":
      return fail("None of the chosen engines can run for this project.");
    case "GeoWriterCreditsExhaustedError":
      return fail(
        failure.message ?? "The workspace is out of AI answers for scans."
      );
    case "GeoSettingsDisabledError":
      return fail(
        "Brand tracking is off for this project, so its prompts can't be scanned."
      );
    case "GeoSettingsMissingError":
      return fail("This project has no AI visibility settings yet.");
    case "GeoProjectNotFoundError":
      return fail("The project for this step no longer exists.");
    default:
      return {
        ok: false,
        reason: `The scan couldn't start (${failure._tag})`,
        outcome: "retry",
      };
  }
}

/**
 * Each engine's best answer across languages: false when none named the
 * brand, otherwise its best rank, or null when it was named without one.
 */
function byEngine(results: readonly AutopilotPromptScanResult[]) {
  const engines = new Map<string, number | null | false>();
  for (const row of results) {
    const current = engines.get(row.engine);
    if (!row.mentioned) {
      // A mention without a rank is null; a later miss must not erase it.
      engines.set(row.engine, current === undefined ? false : current);
      continue;
    }
    if (typeof current === "number") {
      engines.set(
        row.engine,
        row.position === null ? current : Math.min(current, row.position)
      );
      continue;
    }
    engines.set(row.engine, row.position);
  }
  return engines;
}

function answeredLine(params: {
  prompt: string;
  named: string[];
  missed: string[];
  answered: number;
}) {
  const { prompt, named, missed, answered } = params;
  if (answered === 0) {
    return `No engine answered "${prompt}" yet.`;
  }
  if (answered === 1) {
    return named.length === 1
      ? `For "${prompt}", ${named[0]} mentioned you.`
      : `For "${prompt}", ${missed[0]} didn't mention you.`;
  }
  return `For "${prompt}", ${named.length} of ${answered} engines mentioned you${named.length > 0 ? `: ${named.join(", ")}` : ""}.`;
}

/** One line a Slack post or agent step can use as is. */
export function summarizeAutopilotPromptScan(params: {
  prompt: string;
  status: "running" | "completed" | "failed";
  errorMessage: string | null;
  engines: readonly string[];
  results: readonly AutopilotPromptScanResult[];
}) {
  const { prompt, status, errorMessage, engines, results } = params;
  if (status === "failed" && results.length === 0) {
    return `The scan of "${prompt}" failed${errorMessage ? `: ${errorMessage}` : "."}`;
  }
  const answered = byEngine(results);
  const named = [...answered]
    .filter(([, best]) => best !== false)
    .map(([engine, best]) =>
      typeof best === "number" ? `${engine} (#${best})` : engine
    );
  const missed = [...answered]
    .filter(([, best]) => best === false)
    .map(([engine]) => engine);
  const pending = engines.filter((engine) => !answered.has(engine));
  const parts = [
    answeredLine({ prompt, named, missed, answered: answered.size }),
  ];
  if (missed.length > 0 && named.length > 0) {
    parts.push(`Not mentioned by ${missed.join(", ")}.`);
  }
  if (pending.length > 0) {
    parts.push(
      status === "running"
        ? `Still waiting on ${pending.join(", ")} after ${AUTOPILOT_WORKFLOW_SCAN_PROMPT_WAIT_MS / 60_000} minutes; their answers show up in AI visibility when they finish.`
        : `No answer from ${pending.join(", ")}.`
    );
  }
  return parts.join(" ");
}
