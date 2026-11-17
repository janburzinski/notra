export const CODE_RESEARCHER_DESCRIPTION =
  "Reads the organization's connected GitHub repository in a read-only sandbox to understand one product feature from its code: what it does for users, how they reach it, config, API or CLI surface, and limits. Pass one message with the feature description, the GitHub integrationId, and any known pull request number, branch, commit, or time window. Returns a structured feature brief, not prose.";

export const CONTENT_WRITER_DESCRIPTION =
  "Writes and saves content posts (changelog, blog post, tweet, LinkedIn post, investor update) from the organization's connected sources. Loads the organization's writing skills, studies brand references, gathers GitHub/Linear data, then saves the post to the database. Pass one message containing the content type, source instructions, lookback context, and any code research brief verbatim. Returns a structured created/skipped/failed result.";

export const IMAGE_DESIGNER_DESCRIPTION =
  "Creates and revises 1200x630 marketing images from a connected GitHub repository using a sandboxed design agent. Pass one message containing the integrationId, branch, mode (prompt, pr, or commit) with its value, any brand identity id, the requested title, and for revisions the postId of the existing image. Generation takes 3 to 8 minutes. Returns a structured result with the saved post id and image URL.";

// Subagent directory names. Each is hidden from the model (tool: false) and
// called through the workflow tool of the same name without "-agent", which
// asks for its structured result: eve 1.0 rejects a tool and a subagent that
// share a name, even when the subagent sets tool: false.
export const CODE_RESEARCHER_AGENT = "code-researcher-agent";
export const CONTENT_WRITER_AGENT = "content-writer-agent";
export const IMAGE_DESIGNER_AGENT = "image-designer-agent";
