import { callAutopilotAgent } from "@notra/tools/autopilot/client";
import { runAutopilotSpec } from "@notra/tools/autopilot/tools";
import { defineTool } from "eve/tools";

import { autopilotApproval } from "../lib/utils/autopilot-approval";
import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  defineTool({
    description: runAutopilotSpec.description,
    inputSchema: runAutopilotSpec.inputSchema,
    approval: autopilotApproval(runAutopilotSpec.needsConfirmation),
    execute: (input, ctx) =>
      callAutopilotAgent(ctx, runAutopilotSpec.toAction(input)),
  }),
  runAutopilotSpec.activityLabel
);
