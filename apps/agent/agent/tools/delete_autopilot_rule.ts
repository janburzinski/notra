import { callAutopilotAgent } from "@notra/tools/autopilot/client";
import { deleteAutopilotRuleSpec } from "@notra/tools/autopilot/tools";
import { defineTool } from "eve/tools";

import { autopilotApproval } from "../lib/utils/autopilot-approval";
import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  defineTool({
    description: deleteAutopilotRuleSpec.description,
    inputSchema: deleteAutopilotRuleSpec.inputSchema,
    approval: autopilotApproval(deleteAutopilotRuleSpec.needsConfirmation),
    execute: (input, ctx) =>
      callAutopilotAgent(ctx, deleteAutopilotRuleSpec.toAction(input)),
  }),
  deleteAutopilotRuleSpec.activityLabel
);
