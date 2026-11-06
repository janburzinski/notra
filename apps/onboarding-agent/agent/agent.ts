import { onboardingProfileSchema } from "@notra/ai/schemas/onboarding-agent";
import { defineAgent } from "eve";

import {
  GLM_CONTEXT_WINDOW_TOKENS,
  ONBOARDING_MODEL_ID,
} from "./lib/constants/models";
import { createAgentModel } from "./lib/utils/model";

export default defineAgent({
  model: createAgentModel(
    ONBOARDING_MODEL_ID,
    "onboarding-agent",
    GLM_CONTEXT_WINDOW_TOKENS
  ),
  modelContextWindowTokens: GLM_CONTEXT_WINDOW_TOKENS,
  reasoning: "medium",
  outputSchema: onboardingProfileSchema,
});
