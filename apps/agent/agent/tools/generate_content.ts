import { log } from "@notra/ai/evlog";
import { codeResearchBriefSchema } from "@notra/ai/schemas/code-research";
import { contentWriterResultSchema } from "@notra/ai/schemas/content-writer-result";
import type { CodeResearchBrief } from "@notra/ai/types/code-research";
import { releaseCodeResearchWorkspaces } from "@notra/ai/utils/code-research-session";
import { isCodeResearchEnabled } from "@notra/tools/utils/code-research";
import { defineWorkflowTool, type WorkflowToolContext } from "eve/tools";

import {
  CODE_RESEARCHER_AGENT,
  CONTENT_WRITER_AGENT,
} from "../lib/constants/subagents";
import { contentTaskInputSchema } from "../lib/schemas/content-task";
import type {
  ContentTaskInput,
  ContentTaskResult,
  ContentTaskTool,
} from "../lib/types/content-task";
import { requestSubagentResult } from "../lib/utils/subagent-result";

async function canResearchCode(
  session: WorkflowToolContext["session"]
): Promise<boolean> {
  // codeql[js/unknown-directive] Eve requires this directive for durable steps.
  "use step";

  return isCodeResearchEnabled({ session });
}

async function releaseResearchBoxes(sessionKey: string): Promise<void> {
  // codeql[js/unknown-directive] Eve requires this directive for durable steps.
  "use step";

  try {
    await releaseCodeResearchWorkspaces(sessionKey);
  } catch (error) {
    log.warn({
      event: "code_research.box_release_failed",
      sessionKey,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function researchFeature(
  ctx: WorkflowToolContext,
  message: string
): Promise<CodeResearchBrief | null> {
  try {
    const brief = await requestSubagentResult(
      ctx,
      CODE_RESEARCHER_AGENT,
      message,
      codeResearchBriefSchema
    );
    return brief.status === "found" ? brief : null;
  } catch {
    return null;
  }
}

async function generateContentTask(
  { message, codeResearch }: ContentTaskInput,
  ctx: WorkflowToolContext
): Promise<ContentTaskResult> {
  // codeql[js/unknown-directive] Eve requires this directive for durable execution.
  "use workflow";

  const shouldResearch =
    codeResearch !== undefined && (await canResearchCode(ctx.session));
  const sessionKey = ctx.session.parent?.rootSessionId ?? ctx.session.id;
  try {
    const brief = shouldResearch
      ? await researchFeature(ctx, codeResearch)
      : null;
    const writerMessage = brief
      ? `${message}\n\nCode research brief (JSON):\n${JSON.stringify(brief)}`
      : message;
    return await requestSubagentResult(
      ctx,
      CONTENT_WRITER_AGENT,
      writerMessage,
      contentWriterResultSchema
    );
  } finally {
    if (shouldResearch) {
      await releaseResearchBoxes(sessionKey);
    }
  }
}

const generateContent: ContentTaskTool = defineWorkflowTool({
  label: { start: () => "Researching and drafting content" },
  description:
    "Generate and save content through the content-writer, waiting durably for its final created/skipped/failed result. Use this for automated content tasks instead of calling the background content-writer subagent directly. Pass the complete task, sources, and lookback context in message. For a task about one specific feature, also pass codeResearch so the code-researcher reads the repository first.",
  inputSchema: contentTaskInputSchema,
  outputSchema: contentWriterResultSchema,
  execute: generateContentTask,
});

export default generateContent;
