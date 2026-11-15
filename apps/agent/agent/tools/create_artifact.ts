import { createCreateArtifactTool } from "@notra/tools/assistant/artifacts";

import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  createCreateArtifactTool(),
  "Building the report"
);
