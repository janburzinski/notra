import { callAutopilotAgent } from "@notra/tools/autopilot/client";
import { updateAutopilotSettingsSpec } from "@notra/tools/autopilot/tools";
import { defineTool } from "eve/tools";

import { autopilotApproval } from "../lib/utils/autopilot-approval";
import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  defineTool({
    description: updateAutopilotSettingsSpec.description,
    inputSchema: updateAutopilotSettingsSpec.inputSchema,
    approval: autopilotApproval(updateAutopilotSettingsSpec.needsConfirmation),
    execute: (input, ctx) =>
      callAutopilotAgent(ctx, updateAutopilotSettingsSpec.toAction(input)),
  }),
  updateAutopilotSettingsSpec.activityLabel
);
