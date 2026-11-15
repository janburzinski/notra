import { toolOutputArtifactSchema } from "@notra/ai/schemas/artifact";
import type { ArtifactToolOutput } from "@notra/ai/types/artifact";
import { getToolName, isToolUIPart, type UIMessage } from "ai";

import type { ChatArtifactEntry } from "@/types/artifacts";

const parsedOutputs = new WeakMap<
  object,
  ArtifactToolOutput["artifact"] | undefined
>();

/**
 * The artifact a tool saved, whichever agent ran it (dashboard or Slack).
 * A finished output doesn't change, so each one is parsed once, not again
 * on every streamed chunk of the chat.
 */
export function parseToolOutputArtifact(
  output: unknown
): ArtifactToolOutput["artifact"] | undefined {
  if (typeof output !== "object" || output === null) {
    return undefined;
  }
  if (parsedOutputs.has(output)) {
    return parsedOutputs.get(output);
  }
  const parsed = toolOutputArtifactSchema.safeParse(output);
  const artifact = parsed.success ? parsed.data.artifact : undefined;
  parsedOutputs.set(output, artifact);
  return artifact;
}

export function artifactTabId(artifactId: string) {
  return `artifact:${artifactId}`;
}

/**
 * The newest tool call that saved an artifact, created or updated, so the
 * chat can open what the agent just wrote.
 */
export function getLatestArtifactWrite(
  messages: UIMessage[]
): { toolCallId: string; artifactId: string } | undefined {
  for (const message of messages.toReversed()) {
    if (message.role !== "assistant") {
      continue;
    }
    for (const part of message.parts.toReversed()) {
      if (!isToolUIPart(part) || part.state !== "output-available") {
        continue;
      }
      const artifact = parseToolOutputArtifact(part.output);
      if (artifact) {
        return { toolCallId: part.toolCallId, artifactId: artifact.id };
      }
    }
  }
  return undefined;
}

/**
 * Every artifact the chat saved, once each, in the order they first came up.
 * Later updates only change the title the tab shows.
 */
export function getChatArtifacts(messages: UIMessage[]): ChatArtifactEntry[] {
  const byId = new Map<string, ChatArtifactEntry>();
  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }
    for (const part of message.parts) {
      if (!isToolUIPart(part) || part.state !== "output-available") {
        continue;
      }
      const artifact = parseToolOutputArtifact(part.output);
      if (!artifact) {
        continue;
      }
      byId.set(artifact.id, {
        tabId: artifactTabId(artifact.id),
        artifactId: artifact.id,
        title: artifact.title || getToolName(part),
      });
    }
  }
  return [...byId.values()];
}
