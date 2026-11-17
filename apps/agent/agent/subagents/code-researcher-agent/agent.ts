import { AGENT_DEFAULT_MODEL } from "@notra/ai/constants/models";
import { defineAgent } from "eve";

import { GLM_CONTEXT_WINDOW_TOKENS } from "../../lib/constants/models";
import { CODE_RESEARCHER_DESCRIPTION } from "../../lib/constants/subagents";
import { createSessionAgentModel } from "../../lib/utils/session-model";

export default defineAgent({
  description: CODE_RESEARCHER_DESCRIPTION,
  model: createSessionAgentModel(
    AGENT_DEFAULT_MODEL,
    "content-code-researcher",
    GLM_CONTEXT_WINDOW_TOKENS
  ),
  // The parent calls this through agent/tools/code-researcher.ts, which asks for its
  // structured result.
  tool: false,
});
