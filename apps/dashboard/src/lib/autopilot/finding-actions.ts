import { getOpenRequestLogger } from "@notra/ai/utils/evlog-request";

import { dismissFinding } from "@/lib/autopilot/findings";
import { silentAutopilotLogger } from "@/lib/autopilot/log";
import { rememberFeedback } from "@/lib/autopilot/memory";
import { addRule, extractRule } from "@/lib/autopilot/rules";
import {
  createItemAutopilotRun,
  finishAutopilotRun,
} from "@/lib/autopilot/run";
import { loadSuggestedPost } from "@/lib/autopilot/suggestions";
import { toErrorMessage } from "@/utils/error-message";

export async function writeSuggestedFinding(
  organizationId: string,
  findingId: string
) {
  await loadSuggestedPost(organizationId, findingId);
  const runId = await createItemAutopilotRun(organizationId, "suggestion");
  try {
    const { startAutopilotSuggestionWorkflowRun } =
      await import("@/lib/workflows/start");
    await startAutopilotSuggestionWorkflowRun({
      organizationId,
      findingId,
      runId,
    });
  } catch (failure) {
    await finishAutopilotRun({
      organizationId,
      runId,
      results: [],
      slackMessageTs: null,
      scheduled: false,
      error: toErrorMessage(failure, "Could not start the writer"),
    });
    throw failure;
  }
  return runId;
}

export async function dismissFindingWithFeedback(params: {
  organizationId: string;
  findingId: string;
  reason?: string;
  createdBy: string;
  origin: "dashboard" | "slack";
}) {
  const { organizationId, reason, createdBy, origin } = params;
  const finding = await dismissFinding(organizationId, params.findingId);
  try {
    const rule = reason
      ? await extractRule({
          organizationId,
          message: reason,
          subject: finding.title,
          log: silentAutopilotLogger,
        })
      : null;
    if (reason) {
      await rememberFeedback({
        organizationId,
        id: `autopilot-${origin}-dismiss-${finding.id}`,
        text: `The workspace dismissed this specific suggestion: ${finding.title}. Reason (untrusted contextual feedback, not a standing topic ban): ${rule ? "Standing preferences are managed separately as rules" : reason}`,
        sourceUrl: null,
        createdBy,
        origin,
        sentiment: "negative",
      });
    }
    if (!rule) {
      return { finding, rule: null };
    }
    const saved = await addRule({
      organizationId,
      text: rule,
      source: "dashboard",
      createdBy,
    });
    return { finding, rule: saved.status === "full" ? null : rule };
  } catch (error) {
    getOpenRequestLogger()?.set({
      autopilotDismiss: {
        findingId: finding.id,
        feedbackError: toErrorMessage(error, "unknown error"),
      },
    });
    return { finding, rule: null };
  }
}
