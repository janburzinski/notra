"use client";

import { Kbd } from "@notra/ui/components/ui/kbd";
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { useIsApplePlatform } from "@notra/ui/hooks/use-is-apple-platform";
import { useEffect, useEffectEvent, useState } from "react";
import { useTranslations } from "use-intl";

import { CONTENT_DOCUMENT_TABS } from "@/constants/content-detail";
import { cn } from "@/lib/utils";
import type { ContentDocumentTabsProps } from "@/types/content/detail";

export function ContentDocumentTabs({
  enabled,
  value,
  onValueChange,
}: ContentDocumentTabsProps) {
  const t = useTranslations("content.detail.tabs");
  const isApplePlatform = useIsApplePlatform();
  const modifier = isApplePlatform ? "⌘" : "Ctrl";
  const [isModifierHeld, setIsModifierHeld] = useState(false);

  const selectTab = useEffectEvent(onValueChange);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      setIsModifierHeld(event.metaKey || event.ctrlKey);
      if (
        event.repeat ||
        !(event.metaKey || event.ctrlKey) ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const tab = CONTENT_DOCUMENT_TABS[Number(event.key) - 1];
      if (tab) {
        event.preventDefault();
        selectTab(tab);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      setIsModifierHeld(event.metaKey || event.ctrlKey);
    };
    const releaseModifier = () => setIsModifierHeld(false);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseModifier);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseModifier);
    };
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <Tabs
      className="relative z-10 mx-4 mt-3 shrink-0 lg:mx-6"
      onValueChange={(next) =>
        onValueChange(next === "outline" ? "outline" : "post")
      }
      value={value}
    >
      <TabsList>
        {CONTENT_DOCUMENT_TABS.map((tab, index) => (
          <Tooltip key={tab}>
            <TooltipTrigger
              render={
                <TabsTrigger
                  aria-keyshortcuts={`${isApplePlatform ? "Meta" : "Control"}+${index + 1}`}
                  value={tab}
                />
              }
            >
              {t(tab)}
              <span
                aria-hidden="true"
                className={cn(
                  "bg-popover ring-border text-muted-foreground pointer-events-none absolute top-full left-1/2 mt-1.5 inline-flex h-6 -translate-x-1/2 items-center rounded-md px-1.5 text-xs font-medium shadow-sm ring-1 transition-opacity duration-150 ease-out select-none",
                  isModifierHeld ? "opacity-100" : "opacity-0"
                )}
              >
                {modifier}
                {index + 1}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {t(tab)}
              <Kbd>
                {modifier}
                {index + 1}
              </Kbd>
            </TooltipContent>
          </Tooltip>
        ))}
      </TabsList>
    </Tabs>
  );
}
