import { UTILITY_MODEL_ID } from "@notra/ai/constants/models";
import { loadSkillByName } from "@notra/ai/skills/functions/service";
import { UNSLOP_CONTENT } from "@notra/ai/skills/unslop-content";
import type { AgentTokenUsage } from "@notra/ai/types/agents";

import {
  AUTOPILOT_DASH_REWRITE_INSTRUCTIONS,
  AUTOPILOT_DASH_REWRITE_MAX_OUTPUT_TOKENS,
  AUTOPILOT_DASH_REWRITE_MAX_SENTENCES,
} from "@/constants/autopilot-style";
import { generateAutopilotObject } from "@/lib/autopilot/llm";
import { dashRewriteSchema } from "@/schemas/autopilot";
import type { AutopilotLogger } from "@/types/autopilot-runtime";
import { applyPageEdits } from "@/utils/autopilot-edits";
import {
  fixNumericRanges,
  forceNoDashes,
  keepsFacts,
  newDashSentences,
} from "@/utils/autopilot-style";

/**
 * The workspace's writing rules: its own "unslop" skill when the team edited
 * it, otherwise Notra's. Every Autopilot writer follows them.
 */
export async function loadWritingRules(organizationId: string) {
  const skill = await loadSkillByName({ organizationId }, "unslop").catch(
    () => null
  );
  return skill?.content ?? UNSLOP_CONTENT;
}

/**
 * Takes em and en dashes out of what Autopilot wrote, never out of what the
 * page already said. Ranges are fixed in code, sentences are rewritten by a
 * small model as exact edits, and a dash that survives becomes a comma.
 */
export async function removeNewDashes(params: {
  organizationId: string;
  log: AutopilotLogger;
  content: string;
  previous: string | null;
  onUsage?: (usage: AgentTokenUsage) => void;
}) {
  let content = fixNumericRanges(params.content);
  const sentences = newDashSentences(content, params.previous);
  if (sentences.length === 0) {
    return content;
  }
  try {
    const rewrite = await generateAutopilotObject({
      organizationId: params.organizationId,
      modelId: UTILITY_MODEL_ID,
      tag: "no-dashes",
      log: params.log,
      schema: dashRewriteSchema,
      instructions: AUTOPILOT_DASH_REWRITE_INSTRUCTIONS,
      prompt: sentences
        .slice(0, AUTOPILOT_DASH_REWRITE_MAX_SENTENCES)
        .map((sentence) => `- ${sentence}`)
        .join("\n"),
      maxOutputTokens: AUTOPILOT_DASH_REWRITE_MAX_OUTPUT_TOKENS,
      onUsage: params.onUsage,
    });
    // Only the sentences it was given, with the same numbers and links: this
    // runs after the fact and page checks, so it may reword but not rewrite.
    const asked = new Set(sentences);
    const safe = rewrite.edits.filter(
      (edit) => asked.has(edit.find) && keepsFacts(edit.find, edit.replace)
    );
    if (safe.length < rewrite.edits.length) {
      await params.log.info(
        `Dropped ${rewrite.edits.length - safe.length} dash rewrites that changed more than the wording`
      );
    }
    content = applyPageEdits(
      content,
      safe.map((edit) => ({ action: "update", section: "", ...edit }))
    ).content;
  } catch (error) {
    await params.log.info("Dash rewrite failed; replacing them in code", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  const left = newDashSentences(content, params.previous).length;
  if (left > 0) {
    content = forceNoDashes(content, params.previous);
  }
  await params.log.info(`Took dashes out of ${sentences.length} sentences`, {
    reason: left > 0 ? `${left} replaced in code` : "rewritten",
  });
  return content;
}
