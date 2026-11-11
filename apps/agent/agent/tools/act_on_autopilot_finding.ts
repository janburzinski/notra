import { callAutopilotAgent } from "@notra/tools/autopilot/client";
import { actOnAutopilotFindingSpec } from "@notra/tools/autopilot/tools";
import { defineTool } from "eve/tools";

import { autopilotApproval } from "../lib/utils/autopilot-approval";
import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  defineTool({
    description: actOnAutopilotFindingSpec.description,
    inputSchema: actOnAutopilotFindingSpec.inputSchema,
    approval: autopilotApproval(actOnAutopilotFindingSpec.needsConfirmation),
    execute: (input, ctx) =>
      callAutopilotAgent(ctx, actOnAutopilotFindingSpec.toAction(input)),
  }),
  actOnAutopilotFindingSpec.activityLabel
);
