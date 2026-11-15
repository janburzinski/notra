import { createUpdateArtifactTool } from "@notra/tools/assistant/artifacts";

import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  createUpdateArtifactTool(),
  "Updating the report"
);
