import { autopilotAgentRequestSchema } from "@notra/ai/schemas/autopilot-agent";
import { logError } from "@notra/ai/utils/server-log";

import {
  AutopilotAgentError,
  handleAutopilotAgentRequest,
} from "@/lib/autopilot/agent";
import { verifyInternalWorkflowRequest } from "@/lib/workflows/internal-auth";

export async function POST(request: Request) {
  if (!(await verifyInternalWorkflowRequest(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = autopilotAgentRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  try {
    return Response.json(await handleAutopilotAgentRequest(parsed.data));
  } catch (error) {
    if (error instanceof AutopilotAgentError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    logError("Autopilot agent action failed", error, {
      organizationId: parsed.data.organizationId,
      action: parsed.data.action.type,
    });
    return Response.json(
      { error: "Autopilot couldn't do that right now. Try again shortly." },
      { status: 500 }
    );
  }
}
