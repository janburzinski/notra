import { defineAgent } from "eve";

import {
  IMAGE_DESIGNER_MODEL_ID,
  GLM_CONTEXT_WINDOW_TOKENS,
} from "../../lib/constants/models";
import { IMAGE_DESIGNER_DESCRIPTION } from "../../lib/constants/subagents";
import { createSessionAgentModel } from "../../lib/utils/session-model";

export default defineAgent({
  description: IMAGE_DESIGNER_DESCRIPTION,
  model: createSessionAgentModel(
    IMAGE_DESIGNER_MODEL_ID,
    "content-image-designer",
    GLM_CONTEXT_WINDOW_TOKENS
  ),
  // The parent calls this through agent/tools/image-designer.ts, which asks for its
  // structured result.
  tool: false,
});
