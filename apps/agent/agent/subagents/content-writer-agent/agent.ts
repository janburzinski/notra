import { defineAgent } from "eve";

import {
  CONTENT_WRITER_MODEL_ID,
  OPUS_5_5_CONTEXT_WINDOW_TOKENS,
} from "../../lib/constants/models";
import { CONTENT_WRITER_DESCRIPTION } from "../../lib/constants/subagents";
import { createSessionAgentModel } from "../../lib/utils/session-model";

export default defineAgent({
  description: CONTENT_WRITER_DESCRIPTION,
  model: createSessionAgentModel(
    CONTENT_WRITER_MODEL_ID,
    "content-writer-agent",
    OPUS_5_5_CONTEXT_WINDOW_TOKENS
  ),
  // The parent calls this through agent/tools/content-writer.ts, which asks for its
  // structured result.
  tool: false,
});
