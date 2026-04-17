"use client";

import {
  Message,
  MessageContent,
  MessageResponse,
} from "@notra/ui/components/ai-elements/message";
import { buttonVariants } from "@notra/ui/components/ui/button";
import type { UIMessage } from "ai";
import { ExternalLinkIcon, EyeIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ChatToolBlock } from "@/components/ai/chat-tool-block";
import { ShareForkButton } from "./share-fork-button";

const BlogChangelogPreview = dynamic(
  () =>
    import("@/components/ai/blog-changelog-preview").then(
      (mod) => mod.BlogChangelogPreview
    ),
  { ssr: false }
);

const TwitterPreview = dynamic(
  () =>
    import("@/components/ai/twitter-preview").then((mod) => mod.TwitterPreview),
  { ssr: false }
);

const LinkedInPreview = dynamic(
  () =>
    import("@/components/ai/linkedin-preview").then(
      (mod) => mod.LinkedInPreview
    ),
  { ssr: false }
);

const CREATE_TOOL_TYPES = {
  "tool-createBlogPost": "blog_post",
  "tool-createChangelog": "changelog",
  "tool-createInvestorUpdate": "investor_update",
  "tool-createLinkedInPost": "linkedin_post",
  "tool-createTwitterPost": "twitter_post",
} as const;

type CreateToolType = keyof typeof CREATE_TOOL_TYPES;

function isCreateTool(type: string): type is CreateToolType {
  return type in CREATE_TOOL_TYPES;
}

interface SharedChatViewProps {
  title: string;
  messages: UIMessage[];
  allowFork: boolean;
  shareToken: string;
  ownerName: string | null;
  organizationName: string | null;
  isAuthenticated: boolean;
  workspaceUrl: string | null;
}

export function SharedChatView({
  title,
  messages,
  allowFork,
  shareToken,
  ownerName,
  organizationName,
  isAuthenticated,
  workspaceUrl,
}: SharedChatViewProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-medium text-base">{title}</h1>
              <span
                aria-label="Read-only"
                className="flex shrink-0 items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 text-[11px] text-muted-foreground"
                title="Read-only snapshot"
              >
                <EyeIcon className="size-3" />
                Read-only
              </span>
            </div>
            {(ownerName || organizationName) && (
              <p className="truncate text-muted-foreground text-xs">
                Shared by {ownerName ?? "someone"}
                {organizationName ? ` · ${organizationName}` : ""}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {workspaceUrl && (
              <Link
                className={buttonVariants({ size: "sm", variant: "outline" })}
                href={workspaceUrl}
              >
                <ExternalLinkIcon className="size-4" />
                Open in workspace
              </Link>
            )}
            {allowFork && (
              <ShareForkButton
                isAuthenticated={isAuthenticated}
                shareToken={shareToken}
              />
            )}
          </div>
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
  return (
    <Message from={message.role}>
      <MessageContent>
        {message.parts.map((part, index) =>
          renderPart(part, message.id, index)
        )}
      </MessageContent>
    </Message>
  );
}

type ToolPart = {
  type: string;
  state?: string;
  toolCallId?: string;
  input?: { title?: string; markdown?: string } & Record<string, unknown>;
  output?: Record<string, unknown>;
};

function renderPart(
  part: UIMessage["parts"][number],
  messageId: string,
  index: number
) {
  const key = `${messageId}-${index}`;
  if (part.type === "text") {
    if (!part.text.trim()) {
      return null;
    }
    return <MessageResponse key={key}>{part.text}</MessageResponse>;
  }
  if (part.type === "reasoning") {
    if (!part.text.trim()) {
      return null;
    }
    return (
      <div
        className="rounded-md border border-dashed bg-muted/30 p-3 text-muted-foreground text-xs"
        key={key}
      >
        <p className="mb-1 font-medium uppercase tracking-wide">Reasoning</p>
        <p className="whitespace-pre-wrap">{part.text}</p>
      </div>
    );
  }

  if (typeof part.type !== "string" || !part.type.startsWith("tool-")) {
    return null;
  }

  const toolPart = part as unknown as ToolPart;
  const toolKey = toolPart.toolCallId ?? key;

  if (isCreateTool(toolPart.type)) {
    const contentType = CREATE_TOOL_TYPES[toolPart.type];
    const title = toolPart.input?.title ?? "Untitled";
    const markdown = toolPart.input?.markdown ?? "";
    const previewState: "draft" | "finished" =
      toolPart.state === "output-available" ? "finished" : "draft";

    if (contentType === "twitter_post") {
      return (
        <TwitterPreview
          key={toolKey}
          markdown={markdown}
          state={previewState}
          title={title}
        />
      );
    }
    if (contentType === "linkedin_post") {
      return (
        <LinkedInPreview
          key={toolKey}
          markdown={markdown}
          state={previewState}
          title={title}
        />
      );
    }
    return (
      <BlogChangelogPreview
        contentType={contentType}
        key={toolKey}
        markdown={markdown}
        state={previewState}
        title={title}
      />
    );
  }

  const state = toolPart.state;
  if (
    state === "input-streaming" ||
    state === "input-available" ||
    state === "output-available"
  ) {
    return (
      <ChatToolBlock
        input={toolPart.input}
        key={toolKey}
        output={toolPart.output}
        state={state}
        toolName={toolPart.type.replace("tool-", "")}
      />
    );
  }
  return null;
}
