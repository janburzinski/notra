import { createGetArtifactTool } from "@notra/tools/assistant/artifacts";

import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  createGetArtifactTool(),
  "Reading the report"
);
