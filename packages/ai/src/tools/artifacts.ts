import {
  artifactModelText,
  artifactToolOutput,
  createArtifact,
  listArtifacts,
  parseWrittenArtifact,
  readArtifactForModel,
  updateArtifact,
} from "@notra/ai/chat/artifacts";
import {
  ARTIFACT_FILE_GUIDE,
  CREATE_ARTIFACT_TOOL_NAME,
  GET_ARTIFACT_TOOL_NAME,
  LIST_ARTIFACTS_TOOL_NAME,
  UPDATE_ARTIFACT_TOOL_NAME,
} from "@notra/ai/constants/artifacts";
import {
  createArtifactInputSchema,
  getArtifactInputSchema,
  listArtifactsInputSchema,
  updateArtifactInputSchema,
} from "@notra/ai/schemas/artifact";
import type { ArtifactWriter } from "@notra/ai/types/artifact";
import { toolDescription } from "@notra/ai/utils/description";
import { type Tool, tool } from "ai";
import type { z } from "zod";

/** Shared by the dashboard chat and the Slack agent so both write the same thing. */
export const ARTIFACT_TOOL_GUIDE = {
  create: toolDescription({
    toolName: CREATE_ARTIFACT_TOOL_NAME,
    intro:
      "Saves a report or visual as an artifact: a page made of blocks (text, metrics, chart, table, callout, Autopilot items, sources) that the team can open, share and come back to.",
    whenToUse:
      "When the user asks for a report, a summary to keep or share, a dashboard, or to visualize data, or when the answer combines numbers, a chart and an explanation.",
    whenNotToUse:
      "For a short answer, one number, or anything that fits in two paragraphs. Never for blog posts, changelogs or social posts: use their own tools.",
    usageNotes: `Read the data with the other tools first and only use numbers they returned. Start with a metrics block for the headline numbers when there are any, then charts and text. To show Autopilot pull requests or ideas, use an autopilot block with finding ids from the Autopilot status. Keep text short and specific.\n${ARTIFACT_FILE_GUIDE}`,
  }),
  update: toolDescription({
    toolName: UPDATE_ARTIFACT_TOOL_NAME,
    intro:
      "Saves a new version of an artifact's file, in the format the create artifact tool describes. The link stays the same and earlier versions stay available.",
    whenToUse:
      "When the user asks to change, extend or refresh an artifact made earlier.",
    usageNotes:
      "Read the current file with the get artifact tool first, then send the complete new file with the version you read. Copy every block you are not changing exactly as it was. If it says the artifact changed, read it again and redo the change.",
  }),
  get: toolDescription({
    toolName: GET_ARTIFACT_TOOL_NAME,
    intro: "Reads the current version of an artifact as its file.",
    whenToUse:
      "Before updating an artifact, and when the user asks about an artifact's contents.",
  }),
  list: toolDescription({
    toolName: LIST_ARTIFACTS_TOOL_NAME,
    intro:
      "Lists the workspace's artifacts, most recently changed first, with their ids and links.",
    whenToUse:
      "When the user refers to an earlier report or brief whose id you don't have in this conversation.",
  }),
};

/** The tools' work, the same for every agent that has them. */
export function artifactToolHandlers(writer: ArtifactWriter) {
  return {
    create: async (input: z.infer<typeof createArtifactInputSchema>) =>
      artifactToolOutput(
        await createArtifact(writer, parseWrittenArtifact(input.content))
      ),
    update: async (input: z.infer<typeof updateArtifactInputSchema>) =>
      artifactToolOutput(
        await updateArtifact(
          writer,
          input.artifactId,
          parseWrittenArtifact(input.content),
          input.version
        )
      ),
    get: (input: z.infer<typeof getArtifactInputSchema>) =>
      readArtifactForModel(writer.organizationId, input.artifactId),
    list: async (input: z.infer<typeof listArtifactsInputSchema>) => ({
      artifacts: await listArtifacts(writer.organizationId, input),
    }),
  };
}

export function createArtifactTools(writer: ArtifactWriter): {
  tools: Record<string, Tool>;
  description: string;
} {
  const handlers = artifactToolHandlers(writer);
  const toModelOutput = ({
    output,
  }: {
    output: Awaited<ReturnType<typeof handlers.create>>;
  }) => ({ type: "text" as const, value: artifactModelText(output, "chat") });
  return {
    tools: {
      [CREATE_ARTIFACT_TOOL_NAME]: tool({
        description: ARTIFACT_TOOL_GUIDE.create,
        inputSchema: createArtifactInputSchema,
        execute: handlers.create,
        toModelOutput,
      }),
      [UPDATE_ARTIFACT_TOOL_NAME]: tool({
        description: ARTIFACT_TOOL_GUIDE.update,
        inputSchema: updateArtifactInputSchema,
        execute: handlers.update,
        toModelOutput,
      }),
      [GET_ARTIFACT_TOOL_NAME]: tool({
        description: ARTIFACT_TOOL_GUIDE.get,
        inputSchema: getArtifactInputSchema,
        execute: handlers.get,
      }),
      [LIST_ARTIFACTS_TOOL_NAME]: tool({
        description: ARTIFACT_TOOL_GUIDE.list,
        inputSchema: listArtifactsInputSchema,
        execute: handlers.list,
      }),
    },
    description: `**Artifacts**: Save reports and visuals the team can open and share with ${CREATE_ARTIFACT_TOOL_NAME}; change one with ${UPDATE_ARTIFACT_TOOL_NAME} after reading it with ${GET_ARTIFACT_TOOL_NAME}; find an earlier one with ${LIST_ARTIFACTS_TOOL_NAME}. Use them when asked to visualize data or for a report.`,
  };
}
