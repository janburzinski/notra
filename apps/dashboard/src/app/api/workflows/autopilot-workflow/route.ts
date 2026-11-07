import { logError } from "@notra/ai/utils/server-log";
import { isPgUniqueViolation } from "@notra/db/utils/pg-errors";

import { AUTOPILOT_WORKFLOW_RUN_PATH } from "@/constants/autopilot-workflows";
import { isAutopilotEnabledForOrganization } from "@/lib/autopilot/flag";
import {
  anyAutopilotWorkflowRunLaunched,
  dropStaleAutopilotSchedule,
  findScheduledAutopilotWorkflow,
  runAutopilotWorkflow,
} from "@/lib/autopilot/workflows/service";
import { verifyQstashSignature } from "@/lib/workflows/qstash-verify";
import { autopilotWorkflowDeliverySchema } from "@/schemas/autopilot-workflows";

export async function POST(request: Request) {
  const messageId = request.headers.get("upstash-message-id");
  if (!messageId) {
    return new Response("Missing message id", { status: 400 });
  }

  const rawBody = await request.text();
  const verified = await verifyQstashSignature({
    request,
    rawBody,
    path: AUTOPILOT_WORKFLOW_RUN_PATH,
  });
  if (!verified) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  const parsed = autopilotWorkflowDeliverySchema.safeParse(body);
  if (!parsed.success) {
    return new Response("Invalid payload", { status: 400 });
  }

  const workflow = await findScheduledAutopilotWorkflow(parsed.data.workflowId);
  // Only the workflow's current schedule runs it. Any other is left over
  // from a change that didn't finish, or from a deleted workflow, and goes.
  const scheduleId = request.headers.get("upstash-schedule-id");
  if (
    scheduleId &&
    scheduleId !== workflow?.qstashScheduleId &&
    (await dropStaleAutopilotSchedule(parsed.data.workflowId, scheduleId))
  ) {
    return Response.json({ skipped: true });
  }
  // A workspace whose Autopilot was switched off keeps its schedules, but
  // they stop running, the same as everywhere else Autopilot is gated.
  if (
    !workflow?.enabled ||
    !(await isAutopilotEnabledForOrganization(workflow.organizationId))
  ) {
    return Response.json({ skipped: true });
  }
  // Each retry of a delivery gets its own run, so a launch that failed can
  // be tried again; one that launched is never started twice.
  const attempt = Number(request.headers.get("upstash-retried")) || 0;
  const attemptRunId = (n: number) =>
    n === 0 ? `schedule-${messageId}` : `schedule-${messageId}-${n}`;
  const earlier = Array.from({ length: attempt }, (_, n) => attemptRunId(n));
  if (await anyAutopilotWorkflowRunLaunched(earlier)) {
    return Response.json({ duplicate: true });
  }

  try {
    const runId = await runAutopilotWorkflow({
      organizationId: workflow.organizationId,
      workflowId: parsed.data.workflowId,
      trigger: "schedule",
      runId: attemptRunId(attempt),
    });
    return Response.json({ runId }, { status: 202 });
  } catch (error) {
    if (isPgUniqueViolation(error)) {
      return Response.json({ duplicate: true });
    }
    logError("[Autopilot workflow] Scheduled run failed to start", error, {
      workflowId: parsed.data.workflowId,
    });
    return new Response("Failed to start", { status: 500 });
  }
}
