import {
  artifactModelText,
  artifactToolOutput,
  createArtifact,
  readArtifactForModel,
  updateArtifact,
} from "@notra/ai/chat/artifacts";
import {
  CREATE_ARTIFACT_TOOL_NAME,
  GET_ARTIFACT_TOOL_NAME,
  UPDATE_ARTIFACT_TOOL_NAME,
} from "@notra/ai/constants/artifacts";
import {
  artifactContentSchema,
  getArtifactInputSchema,
  updateArtifactInputSchema,
} from "@notra/ai/schemas/artifact";
import type { ArtifactWriter } from "@notra/ai/types/artifact";
import { toolDescription } from "@notra/ai/utils/description";
import { type Tool, tool } from "ai";

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
    usageNotes:
      "Read the data with the other tools first and only use numbers they returned. Start with a metrics block for the headline numbers when there are any, then charts and text. To show Autopilot pull requests or ideas, use an autopilot block with finding ids from the Autopilot status. Keep text blocks short and specific.",
  }),
  update: toolDescription({
    toolName: UPDATE_ARTIFACT_TOOL_NAME,
    intro:
      "Replaces an artifact's title, summary and blocks with a new version. The link stays the same and earlier versions stay available.",
    whenToUse:
      "When the user asks to change, extend or refresh an artifact made earlier.",
    usageNotes: `Send the complete new content, not only the change. Call ${GET_ARTIFACT_TOOL_NAME} first if you don't have the current blocks.`,
  }),
  get: toolDescription({
    toolName: GET_ARTIFACT_TOOL_NAME,
    intro:
      "Reads the current version of an artifact: title, summary and blocks.",
    whenToUse: "Before updating an artifact whose blocks you don't have.",
  }),
};

export function createArtifactTools(writer: ArtifactWriter): {
  tools: Record<string, Tool>;
  description: string;
} {
  const { organizationId } = writer;
  return {
    tools: {
      [CREATE_ARTIFACT_TOOL_NAME]: tool({
        description: ARTIFACT_TOOL_GUIDE.create,
        inputSchema: artifactContentSchema,
        execute: async (input) =>
          artifactToolOutput(await createArtifact(writer, input)),
        toModelOutput: ({ output }) => ({
          type: "text",
          value: artifactModelText(output, "chat"),
        }),
      }),
      [UPDATE_ARTIFACT_TOOL_NAME]: tool({
        description: ARTIFACT_TOOL_GUIDE.update,
        inputSchema: updateArtifactInputSchema,
        execute: async ({ artifactId, ...content }) =>
          artifactToolOutput(
            await updateArtifact(organizationId, artifactId, content)
          ),
        toModelOutput: ({ output }) => ({
          type: "text",
          value: artifactModelText(output, "chat"),
        }),
      }),
      [GET_ARTIFACT_TOOL_NAME]: tool({
        description: ARTIFACT_TOOL_GUIDE.get,
        inputSchema: getArtifactInputSchema,
        execute: ({ artifactId }) =>
          readArtifactForModel(organizationId, artifactId),
      }),
    },
    description: `**Artifacts**: Save reports and visuals the team can open and share with ${CREATE_ARTIFACT_TOOL_NAME}; change one with ${UPDATE_ARTIFACT_TOOL_NAME} (read it first with ${GET_ARTIFACT_TOOL_NAME}). Use them when asked to visualize data or for a report.`,
  };
}
