import {
  artifactModelText,
  artifactToolOutput,
  createArtifact,
  readArtifactForModel,
  updateArtifact,
} from "@notra/ai/chat/artifacts";
import {
  artifactContentSchema,
  getArtifactInputSchema,
  updateArtifactInputSchema,
} from "@notra/ai/schemas/artifact";
import { ARTIFACT_TOOL_GUIDE } from "@notra/ai/tools/artifacts";
import type { SessionContext } from "eve/context";
import { defineTool } from "eve/tools";

import { requireOrganizationId } from "../utils/organization";
import { getSessionAttribute } from "../utils/session";

function isSlackSession(ctx: SessionContext) {
  const auth = ctx.session.auth.current ?? ctx.session.auth.initiator;
  return auth?.authenticator === "slack-webhook";
}

export function createCreateArtifactTool() {
  return defineTool({
    description: ARTIFACT_TOOL_GUIDE.create,
    inputSchema: artifactContentSchema,
    async execute(input, ctx) {
      const saved = await createArtifact(
        {
          organizationId: requireOrganizationId(ctx),
          // The dashboard chat this thread mirrors into, when there is one.
          chatId: getSessionAttribute(ctx, "chatId"),
          source: isSlackSession(ctx) ? "slack" : "chat",
        },
        input
      );
      return artifactToolOutput(saved);
    },
    toModelOutput: (output) => ({
      type: "text",
      value: artifactModelText(output, "slack"),
    }),
  });
}

export function createUpdateArtifactTool() {
  return defineTool({
    description: ARTIFACT_TOOL_GUIDE.update,
    inputSchema: updateArtifactInputSchema,
    async execute({ artifactId, ...content }, ctx) {
      const saved = await updateArtifact(
        requireOrganizationId(ctx),
        artifactId,
        content
      );
      return artifactToolOutput(saved);
    },
    toModelOutput: (output) => ({
      type: "text",
      value: artifactModelText(output, "slack"),
    }),
  });
}

export function createGetArtifactTool() {
  return defineTool({
    description: ARTIFACT_TOOL_GUIDE.get,
    inputSchema: getArtifactInputSchema,
    execute: ({ artifactId }, ctx) =>
      readArtifactForModel(requireOrganizationId(ctx), artifactId),
  });
}
