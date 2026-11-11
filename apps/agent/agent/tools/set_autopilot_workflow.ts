import { callAutopilotAgent } from "@notra/tools/autopilot/client";
import { setAutopilotWorkflowSpec } from "@notra/tools/autopilot/tools";
import { defineTool } from "eve/tools";

import { autopilotApproval } from "../lib/utils/autopilot-approval";
import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  defineTool({
    description: setAutopilotWorkflowSpec.description,
    inputSchema: setAutopilotWorkflowSpec.inputSchema,
    approval: autopilotApproval(setAutopilotWorkflowSpec.needsConfirmation),
    execute: (input, ctx) =>
      callAutopilotAgent(ctx, setAutopilotWorkflowSpec.toAction(input)),
  }),
  setAutopilotWorkflowSpec.activityLabel
);
