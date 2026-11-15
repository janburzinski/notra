import { artifactModelText } from "@notra/ai/chat/artifacts";
import {
  createArtifactInputSchema,
  getArtifactInputSchema,
  listArtifactsInputSchema,
  updateArtifactInputSchema,
} from "@notra/ai/schemas/artifact";
import {
  ARTIFACT_TOOL_GUIDE,
  artifactToolHandlers,
} from "@notra/ai/tools/artifacts";
import type { SessionContext } from "eve/context";
import { defineTool } from "eve/tools";

import { requireOrganizationId } from "../utils/organization";
import { getSessionAttribute } from "../utils/session";

function isSlackSession(ctx: SessionContext) {
  const auth = ctx.session.auth.current ?? ctx.session.auth.initiator;
  return auth?.authenticator === "slack-webhook";
}

function handlers(ctx: SessionContext) {
  const slack = isSlackSession(ctx);
  return artifactToolHandlers({
    organizationId: requireOrganizationId(ctx),
    // The dashboard chat this thread mirrors into, when there is one.
    chatId: getSessionAttribute(ctx, "chatId"),
    // Slack sessions carry a Slack user, not a Notra one.
    userId: slack ? null : getSessionAttribute(ctx, "userId"),
    source: slack ? "slack" : "chat",
  });
}

const toModelOutput = (output: Parameters<typeof artifactModelText>[0]) => ({
  type: "text" as const,
  value: artifactModelText(output, "slack"),
});

export function createCreateArtifactTool() {
  return defineTool({
    description: ARTIFACT_TOOL_GUIDE.create,
    inputSchema: createArtifactInputSchema,
    execute: (input, ctx) => handlers(ctx).create(input),
    toModelOutput,
  });
}

export function createUpdateArtifactTool() {
  return defineTool({
    description: ARTIFACT_TOOL_GUIDE.update,
    inputSchema: updateArtifactInputSchema,
    execute: (input, ctx) => handlers(ctx).update(input),
    toModelOutput,
  });
}

export function createGetArtifactTool() {
  return defineTool({
    description: ARTIFACT_TOOL_GUIDE.get,
    inputSchema: getArtifactInputSchema,
    execute: (input, ctx) => handlers(ctx).get(input),
  });
}

export function createListArtifactsTool() {
  return defineTool({
    description: ARTIFACT_TOOL_GUIDE.list,
    inputSchema: listArtifactsInputSchema,
    execute: (input, ctx) => handlers(ctx).list(input),
  });
}
