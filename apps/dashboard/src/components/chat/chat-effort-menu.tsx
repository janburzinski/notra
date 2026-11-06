"use client";

import {
  AiBrain01Icon,
  Tick02Icon,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { thinkingLevelSchema } from "@notra/ai/schemas/chat";
import type { ThinkingLevel } from "@notra/ai/types/chat";
import { Composer } from "@notra/ui/components/ui/composer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { useTranslations } from "use-intl";

import type { ChatEffortMenuProps } from "@/types/components/chat-input";

export function ChatEffortMenu({
  disabled = false,
  onThinkingLevelChange,
  thinkingLevel,
}: ChatEffortMenuProps) {
  const t = useTranslations("chat.input.thinking");
  const tCommon = useTranslations("common");
  const effortLabel = (level: ThinkingLevel) =>
    level === "off" ? tCommon("labels.off") : tCommon(`labels.${level}`);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Composer.ToolbarButton
            aria-label={t("label")}
            className="min-w-0"
            disabled={disabled}
          />
        }
      >
        <HugeiconsIcon className="size-3.5 shrink-0" icon={AiBrain01Icon} />
        <span className="shrink-0">{effortLabel(thinkingLevel)}</span>
        <HugeiconsIcon className="size-3 shrink-0" icon={UnfoldMoreIcon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44" side="top">
        {thinkingLevelSchema.options.map((level) => (
          <DropdownMenuItem
            key={level}
            onClick={() => onThinkingLevelChange(level)}
          >
            {effortLabel(level)}
            {thinkingLevel === level ? (
              <HugeiconsIcon
                className="text-primary ml-auto size-3.5"
                icon={Tick02Icon}
              />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
