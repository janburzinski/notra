import { defineAgent } from "eve";

import {
  GLM_CONTEXT_WINDOW_TOKENS,
  ONBOARDING_MODEL_ID,
} from "../../lib/constants/models";
import { researchBriefSchema } from "../../lib/schemas/research-brief";
import { createAgentModel } from "../../lib/utils/model";

export default defineAgent({
  description:
    "Fetches and condenses public company data: brand lookup, website pages, sitemap, web search, up to 50 tweets and owned-blog excerpts, and GitHub. Returns an evidence brief plus structured reference candidates, never raw pages.",
  model: createAgentModel(
    ONBOARDING_MODEL_ID,
    "onboarding-researcher",
    GLM_CONTEXT_WINDOW_TOKENS
  ),
  modelContextWindowTokens: GLM_CONTEXT_WINDOW_TOKENS,
  reasoning: "medium",
  outputSchema: researchBriefSchema,
});
