"use client";

import { Clock01Icon, CpuIcon, FlashIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ChatModel } from "@notra/ai/types/chat";
import {
  DetailCardContent,
  DetailCardRow,
} from "@notra/ui/components/ui/detail-card";
import {
  HoverCard,
  HoverCardTrigger,
} from "@notra/ui/components/ui/hover-card";
import { formatCompactNumber } from "@notra/utils/format-compact-number";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "use-intl";

import type {
  AssistantMetadataHoverProps,
  AssistantTokenUsageProps,
} from "@/types/components/assistant-metadata";
import { formatOneDecimal } from "@/utils/format";

const MODEL_CONTEXT_WINDOWS = {
  auto: 1_000_000,
  "zai/glm-5.3": 1_048_576,
  "zai/glm-5.3-flash": 1_048_576,
  "anthropic/claude-opus-5.5": 1_000_000,
  "anthropic/claude-opus-5": 1_000_000,
  "anthropic/claude-opus-4.8": 1_000_000,
  "anthropic/claude-sonnet-5": 1_000_000,
  "anthropic/claude-sonnet-4.6": 1_000_000,
  "anthropic/claude-haiku-4.5": 200_000,
  "openai/gpt-5.4": 1_100_000,
  "openai/gpt-5.5": 272_000,
  "openai/gpt-6-sol": 1_050_000,
  "openai/gpt-6-luna": 1_050_000,
  "openai/gpt-5.6-sol": 1_050_000,
} satisfies Record<ChatModel, number>;

function getModelContextWindow(model: string): number | null {
  return MODEL_CONTEXT_WINDOWS[model as ChatModel] ?? null;
}

function AssistantTokenUsage({
  metadata,
  outputTokens,
}: AssistantTokenUsageProps) {
  const t = useTranslations("chat.metadata");
  const tCommon = useTranslations("common");
  const tChatShared = useTranslations("chat.shared");
  const locale = useLocale();
  const contextWindow = metadata.model
    ? getModelContextWindow(metadata.model)
    : null;

  const tokensLabel = t("tokens", {
    value: formatCompactNumber(outputTokens, locale, 1),
  });

  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <div className="flex cursor-default items-center gap-1">
            <HugeiconsIcon className="size-3" icon={CpuIcon} />
            <span>{tokensLabel}</span>
          </div>
        }
      />
      <DetailCardContent title={tokensLabel}>
        <dl className="flex flex-col">
          {typeof metadata.inputTokens === "number" ? (
            <DetailCardRow label={tCommon("labels.input")}>
              {metadata.inputTokens.toLocaleString(locale)}
            </DetailCardRow>
          ) : null}
          <DetailCardRow label={tCommon("labels.output")}>
            {outputTokens.toLocaleString(locale)}
          </DetailCardRow>
          {contextWindow !== null ? (
            <DetailCardRow label={tChatShared("context")}>
              {formatCompactNumber(contextWindow, locale, 1)}
            </DetailCardRow>
          ) : null}
        </dl>
      </DetailCardContent>
    </HoverCard>
  );
}

export function AssistantMetadataHover({
  metadata,
}: AssistantMetadataHoverProps) {
  const t = useTranslations("chat.metadata");
  const locale = useLocale();

  if (!metadata) {
    return null;
  }

  const items: ReactNode[] = [];

  if (typeof metadata.tokensPerSecond === "number") {
    items.push(
      <div className="flex items-center gap-1" key="tps">
        <HugeiconsIcon className="size-3" icon={FlashIcon} />
        <span>
          {t("tokensPerSecond", {
            value: new Intl.NumberFormat(locale, {
              maximumFractionDigits: 2,
            }).format(metadata.tokensPerSecond),
          })}
        </span>
      </div>
    );
  }

  if (typeof metadata.outputTokens === "number") {
    items.push(
      <AssistantTokenUsage
        key="tokens"
        metadata={metadata}
        outputTokens={metadata.outputTokens}
      />
    );
  }

  if (typeof metadata.ttftMs === "number") {
    const ttftSeconds = metadata.ttftMs / 1000;
    let duration = t("durationSec", { value: Math.round(ttftSeconds) });
    if (metadata.ttftMs < 1000) {
      duration = t("durationMs", { value: Math.round(metadata.ttftMs) });
    } else if (ttftSeconds < 10) {
      duration = t("durationSec", {
        value: formatOneDecimal(ttftSeconds, locale),
      });
    }
    items.push(
      <div className="flex min-w-0 items-center gap-1" key="ttft">
        <HugeiconsIcon className="size-3 shrink-0" icon={Clock01Icon} />
        <span className="truncate">{t("timeToFirstToken", { duration })}</span>
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className="text-muted-foreground duration-fast absolute top-full left-0 flex max-w-full items-center gap-3 overflow-clip pt-1 text-xs whitespace-nowrap opacity-0 transition-opacity group-focus-within/message:opacity-100 group-hover/message:opacity-100 motion-reduce:transition-none [&>div:not(:last-child)]:shrink-0 [@media(hover:none)]:opacity-100"
      data-chat-quote-ignore
    >
      {items}
    </div>
  );
}
