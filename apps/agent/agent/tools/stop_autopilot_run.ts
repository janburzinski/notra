import { callAutopilotAgent } from "@notra/tools/autopilot/client";
import { stopAutopilotRunSpec } from "@notra/tools/autopilot/tools";
import { defineTool } from "eve/tools";

import { autopilotApproval } from "../lib/utils/autopilot-approval";
import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  defineTool({
    description: stopAutopilotRunSpec.description,
    inputSchema: stopAutopilotRunSpec.inputSchema,
    approval: autopilotApproval(stopAutopilotRunSpec.needsConfirmation),
    execute: (input, ctx) =>
      callAutopilotAgent(ctx, stopAutopilotRunSpec.toAction(input)),
  }),
  stopAutopilotRunSpec.activityLabel
);
