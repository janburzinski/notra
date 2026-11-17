"use client";

import {
  Cancel01Icon,
  FilterHorizontalIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { useEffect, useRef } from "react";
import { useTranslations } from "use-intl";

import { cn } from "@/lib/utils";
import type { ChatHistorySourceFilter } from "@/types/chat";
import type { ChatHistoryHeaderProps } from "@/types/components/chat-history";

import { ChatSourceIcon } from "./chat-source-icon";

const ICON_BUTTON_CLASS_NAME =
  "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground data-popup-open:bg-sidebar-accent data-popup-open:text-foreground ring-sidebar-ring duration-fast flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md outline-hidden transition-colors focus-visible:ring-2 [&>svg]:size-4";

export function ChatHistoryHeader({
  source,
  sources,
  onSourceChange,
  query,
  onQueryChange,
  searchOpen,
  onSearchOpenChange,
}: ChatHistoryHeaderProps) {
  const t = useTranslations("dashboard.chatHistory");
  const inputRef = useRef<HTMLInputElement | null>(null);
  // The filter only earns its place once chats come from more than one
  // place; it stays while a filter is applied so it can be cleared.
  const showSourceFilter = sources.length > 1 || source !== "all";

  useEffect(() => {
    if (searchOpen) {
      inputRef.current?.focus();
    }
  }, [searchOpen]);

  function closeSearch() {
    onQueryChange("");
    onSearchOpenChange(false);
  }

  if (searchOpen) {
    return (
      <div className="bg-sidebar-accent/60 focus-within:ring-sidebar-ring flex h-8 items-center gap-1.5 rounded-md pr-1 pl-2 focus-within:ring-1 focus-within:ring-inset">
        <HugeiconsIcon
          aria-hidden
          className="text-muted-foreground size-4 shrink-0"
          icon={Search01Icon}
        />
        <input
          aria-label={t("search")}
          className="placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent text-sm outline-hidden"
          onBlur={() => {
            if (!query.trim()) {
              closeSearch();
            }
          }}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeSearch();
            }
          }}
          placeholder={t("searchPlaceholder")}
          ref={inputRef}
          type="text"
          value={query}
        />
        <button
          aria-label={t("closeSearch")}
          className={ICON_BUTTON_CLASS_NAME}
          // Keeps the input focused so its blur handler doesn't close first.
          onMouseDown={(event) => event.preventDefault()}
          onClick={closeSearch}
          type="button"
        >
          <HugeiconsIcon icon={Cancel01Icon} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-8 items-center gap-0.5 pr-1">
      <span className="text-sidebar-foreground/70 px-2 text-xs font-medium">
        {t("recent")}
      </span>

      <div className="ml-auto flex items-center gap-0.5">
        <button
          aria-label={t("search")}
          className={ICON_BUTTON_CLASS_NAME}
          onClick={() => onSearchOpenChange(true)}
          type="button"
        >
          <HugeiconsIcon icon={Search01Icon} />
        </button>
        {showSourceFilter && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t("filter")}
              className={cn(
                ICON_BUTTON_CLASS_NAME,
                "relative",
                source !== "all" && "text-foreground"
              )}
            >
              <HugeiconsIcon icon={FilterHorizontalIcon} />
              {source !== "all" && (
                <span
                  aria-hidden
                  className="bg-primary absolute top-1 right-1 size-1.5 rounded-full"
                />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuRadioGroup
                onValueChange={(value) =>
                  onSourceChange(value as ChatHistorySourceFilter)
                }
                value={source}
              >
                <DropdownMenuRadioItem closeOnClick value="all">
                  {t("sources.all")}
                </DropdownMenuRadioItem>
                <DropdownMenuSeparator />
                {sources.map((item) => (
                  <DropdownMenuRadioItem closeOnClick key={item} value={item}>
                    <ChatSourceIcon source={item} />
                    {t(`sources.${item}`)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
