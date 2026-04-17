"use client";

import {
  Message,
  MessageContent,
  MessageResponse,
} from "@notra/ui/components/ai-elements/message";
import type { UIMessage } from "ai";
import { ShareForkButton } from "./share-fork-button";

interface SharedChatViewProps {
  title: string;
  messages: UIMessage[];
  allowFork: boolean;
  shareToken: string;
  ownerName: string | null;
  organizationName: string | null;
  isAuthenticated: boolean;
}

export function SharedChatView({
  title,
  messages,
  allowFork,
  shareToken,
  ownerName,
  organizationName,
  isAuthenticated,
}: SharedChatViewProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate font-medium text-base">{title}</h1>
            {(ownerName || organizationName) && (
              <p className="truncate text-muted-foreground text-xs">
                Shared by {ownerName ?? "someone"}
                {organizationName ? ` · ${organizationName}` : ""}
              </p>
            )}
          </div>
          {allowFork && (
            <ShareForkButton
              isAuthenticated={isAuthenticated}
              shareToken={shareToken}
            />
          )}
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
          {messages.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground text-sm">
              This chat has no messages yet.
            </p>
          ) : (
            messages.map((message) => (
              <MessageBlock key={message.id} message={message} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

function MessageBlock({ message }: { message: UIMessage }) {
  const from = message.role === "user" ? "user" : "assistant";
  return (
    <Message from={from}>
      <MessageContent>
        {message.parts.map((part, index) =>
          renderPart(part, message.id, index)
        )}
      </MessageContent>
    </Message>
  );
}

function renderPart(
  part: UIMessage["parts"][number],
  messageId: string,
  index: number
) {
  const key = `${messageId}-${index}`;
  if (part.type === "text") {
    const text = (part as { text?: string }).text ?? "";
    if (!text.trim()) {
      return null;
    }
    return <MessageResponse key={key}>{text}</MessageResponse>;
  }
  if (part.type === "reasoning") {
    const text = (part as { text?: string }).text ?? "";
    if (!text.trim()) {
      return null;
    }
    return (
      <div
        className="rounded-md border border-dashed bg-muted/30 p-3 text-muted-foreground text-xs"
        key={key}
      >
        <p className="mb-1 font-medium uppercase tracking-wide">Reasoning</p>
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    );
  }
  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
    const toolName = part.type.replace("tool-", "");
    return (
      <div
        className="rounded-md border bg-muted/20 p-3 text-muted-foreground text-xs"
        key={key}
      >
        <span className="font-medium">Tool:</span> {toolName}
      </div>
    );
  }
  return null;
}
