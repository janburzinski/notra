"use client";

import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  File02Icon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type {
  SharedChatMessage,
  SharedChatPart,
} from "@notra/db/types/chat-shares";
import { MessageResponse } from "@notra/ui/components/ai-elements/message";
import { buttonVariants } from "@notra/ui/components/ui/button";
import { Notra } from "@notra/ui/components/ui/svgs/notra";
import { useCallback, useState } from "react";
import { useFormatter, useTranslations } from "use-intl";

import { AuthWordmark } from "@/components/auth/auth-wordmark";
import Link from "@/components/framework/link";
import { SHARED_POST_CONTENT_TYPES } from "@/constants/chat-share";
import { cn } from "@/lib/utils";
import type { PublicChatShare } from "@/types/chat-share";
import { humanizeToolName } from "@/utils/chat-share";

const NOTRA_SITE_URL = "https://usenotra.com";

function SharedPost({
  part,
}: {
  part: Extract<SharedChatPart, { type: "post" }>;
}) {
  const t = useTranslations("chat.sharedPage");
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const measureRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      return;
    }
    const observer = new ResizeObserver(() =>
      setOverflows(node.scrollHeight > node.clientHeight + 1)
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const collapsed = overflows && !expanded;
  const contentType = SHARED_POST_CONTENT_TYPES.find(
    (type) => type === part.contentType
  );
  const label = t(`contentTypes.${contentType ?? "fallback"}`);

  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <HugeiconsIcon
          className="text-muted-foreground size-4 shrink-0"
          icon={File02Icon}
        />
        <span className="min-w-0 truncate text-sm font-medium">
          {part.title || t("untitled")}
        </span>
        <span className="text-muted-foreground ml-auto shrink-0 text-xs">
          {label}
        </span>
      </div>
      <div className="relative">
        <div
          className={cn(
            "px-4 py-3 text-sm",
            !expanded && "max-h-72 overflow-hidden"
          )}
          ref={measureRef}
        >
          <MessageResponse>{part.markdown}</MessageResponse>
        </div>
        {collapsed ? (
          <div className="from-card pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t to-transparent" />
        ) : null}
      </div>
      {overflows || expanded ? (
        <button
          aria-expanded={expanded}
          className="text-muted-foreground hover:text-foreground hover:bg-muted/50 flex w-full items-center justify-center gap-1 border-t px-4 py-2 text-xs font-medium transition-colors"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {expanded ? t("showLess") : t("showMore")}
          <HugeiconsIcon
            className="size-3.5"
            icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
          />
        </button>
      ) : null}
    </div>
  );
}

function SharedPart({ part }: { part: SharedChatPart }) {
  const t = useTranslations("chat.sharedPage");

  if (part.type === "text") {
    return <MessageResponse>{part.text}</MessageResponse>;
  }
  if (part.type === "post") {
    return <SharedPost part={part} />;
  }
  if (part.type === "file") {
    return (
      <span className="bg-muted/40 text-foreground inline-flex max-w-full items-center gap-2 self-end rounded-lg border px-3 py-2 text-xs">
        <HugeiconsIcon
          className="text-muted-foreground size-4 shrink-0"
          icon={File02Icon}
        />
        <span className="truncate">{part.filename}</span>
      </span>
    );
  }
  return (
    <p className="text-muted-foreground flex items-start gap-2 text-xs">
      <HugeiconsIcon className="mt-px size-3.5 shrink-0" icon={Wrench01Icon} />
      <span>
        {t("usedTools", {
          tools: part.names.map(humanizeToolName).join(", "),
        })}
      </span>
    </p>
  );
}

function SharedMessage({ message }: { message: SharedChatMessage }) {
  if (message.role === "user") {
    const files = message.parts.filter((part) => part.type === "file");
    const rest = message.parts.filter((part) => part.type !== "file");
    return (
      <div className="ml-auto flex max-w-[85%] flex-col items-end gap-2">
        {files.map((part) => (
          <SharedPart key={part.id} part={part} />
        ))}
        {rest.length > 0 ? (
          <div className="bg-secondary text-foreground flex min-w-0 flex-col gap-2 overflow-hidden rounded-lg px-4 py-3 text-sm">
            {rest.map((part) => (
              <SharedPart key={part.id} part={part} />
            ))}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex w-full min-w-0 flex-col gap-3 text-sm">
      {message.parts.map((part) => (
        <SharedPart key={part.id} part={part} />
      ))}
    </div>
  );
}

export function SharedChatPage({ share }: { share: PublicChatShare }) {
  const t = useTranslations("chat.sharedPage");
  const format = useFormatter();

  return (
    <div className="bg-background min-h-svh">
      <header className="bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-4">
          <div className="flex">
            <AuthWordmark href={NOTRA_SITE_URL} />
          </div>
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href={NOTRA_SITE_URL}
          >
            <span
              aria-hidden="true"
              className="dark:bg-foreground flex size-4.5 shrink-0 items-center justify-center rounded-sm"
            >
              <Notra className="size-4 dark:size-3.5" />
            </span>
            {t("cta")}
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 pt-10 pb-24">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {share.title}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("sharedBy", {
              organization: share.organizationName,
              date: format.dateTime(new Date(share.sharedAt), {
                dateStyle: "medium",
              }),
            })}
          </p>
        </div>
        <div className="flex flex-col gap-8">
          {share.messages.map((message) => (
            <SharedMessage key={message.id} message={message} />
          ))}
        </div>
        <p className="text-muted-foreground border-t pt-6 text-center text-xs">
          {t("readOnly")}
        </p>
      </main>
    </div>
  );
}
