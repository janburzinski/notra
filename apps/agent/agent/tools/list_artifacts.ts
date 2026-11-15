import { createListArtifactsTool } from "@notra/tools/assistant/artifacts";

import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  createListArtifactsTool(),
  "Looking for reports"
);
