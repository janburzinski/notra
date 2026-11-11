import { callAutopilotAgent } from "@notra/tools/autopilot/client";
import { addAutopilotRuleSpec } from "@notra/tools/autopilot/tools";
import { defineTool } from "eve/tools";

import { autopilotApproval } from "../lib/utils/autopilot-approval";
import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  defineTool({
    description: addAutopilotRuleSpec.description,
    inputSchema: addAutopilotRuleSpec.inputSchema,
    approval: autopilotApproval(addAutopilotRuleSpec.needsConfirmation),
    execute: (input, ctx) =>
      callAutopilotAgent(ctx, addAutopilotRuleSpec.toAction(input)),
  }),
  addAutopilotRuleSpec.activityLabel
);
