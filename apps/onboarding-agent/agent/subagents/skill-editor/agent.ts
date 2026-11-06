import { defineAgent } from "eve";

import {
  GLM_CONTEXT_WINDOW_TOKENS,
  ONBOARDING_MODEL_ID,
} from "../../lib/constants/models";
import { skillEditsSchema } from "../../lib/schemas/skill-edits";
import { createAgentModel } from "../../lib/utils/model";

export default defineAgent({
  description:
    "Edits an organization's content skills in the Notra database based on researched brand evidence: tone, vocabulary, topics, and real writing samples.",
  model: createAgentModel(
    ONBOARDING_MODEL_ID,
    "onboarding-skill-editor",
    GLM_CONTEXT_WINDOW_TOKENS
  ),
  modelContextWindowTokens: GLM_CONTEXT_WINDOW_TOKENS,
  outputSchema: skillEditsSchema,
});
