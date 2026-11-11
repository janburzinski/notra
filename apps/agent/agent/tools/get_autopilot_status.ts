import { callAutopilotAgent } from "@notra/tools/autopilot/client";
import { getAutopilotStatusSpec } from "@notra/tools/autopilot/tools";
import { defineTool } from "eve/tools";

import { autopilotApproval } from "../lib/utils/autopilot-approval";
import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  defineTool({
    description: getAutopilotStatusSpec.description,
    inputSchema: getAutopilotStatusSpec.inputSchema,
    approval: autopilotApproval(getAutopilotStatusSpec.needsConfirmation),
    execute: (input, ctx) =>
      callAutopilotAgent(ctx, getAutopilotStatusSpec.toAction(input)),
  }),
  getAutopilotStatusSpec.activityLabel
);
