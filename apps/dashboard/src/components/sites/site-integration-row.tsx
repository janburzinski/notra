"use client";

import {
  Delete02Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@notra/ui/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { SiteIntegrationLogo } from "@/components/sites/site-integration-logo";
import { cn } from "@/lib/utils";
import type { SiteIntegrationRowProps } from "@/types/components/sites";

export function SiteIntegrationRow({
  provider,
  isSetUp,
  disabled,
  onOpen,
  onRemove,
}: SiteIntegrationRowProps) {
  const t = useTranslations("sites.integrationsPage");
  return (
    <div
      className={cn(
        "group/integration duration-fast relative flex items-center gap-4 rounded-xl p-3 transition-colors",
        provider.recommended
          ? "bg-primary/5 ring-primary/25 hover:bg-primary/10 ring-1 ring-inset"
          : "hover:bg-muted/40"
      )}
    >
      <SiteIntegrationLogo className="size-11 rounded-xl" provider={provider} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <button
            className="focus-visible:ring-ring/50 cursor-pointer rounded-sm text-left text-sm font-medium outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:ring-[3px]"
            onClick={onOpen}
            disabled={disabled}
            type="button"
          >
            {provider.name}
          </button>
          {provider.recommended ? (
            <Badge size="sm">{t("recommended")}</Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground truncate text-sm">
          {t(`providers.${provider.id}`)}
        </p>
      </div>
      {isSetUp ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={t("more", { provider: provider.name })}
                className="relative cursor-pointer"
                size="icon-sm"
                variant="ghost"
                disabled={disabled}
              />
            }
          >
            <HugeiconsIcon
              className="size-4"
              icon={MoreHorizontalIcon}
              strokeWidth={1.5}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={onOpen}>
              <HugeiconsIcon
                icon={PencilEdit02Icon}
                size={14}
                strokeWidth={1.5}
              />
              {t("edit")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRemove} variant="destructive">
              <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={1.5} />
              {t("remove")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          aria-label={t("add", { provider: provider.name })}
          className="relative cursor-pointer"
          onClick={onOpen}
          disabled={disabled}
          size="icon-sm"
          variant="ghost"
        >
          <HugeiconsIcon
            className="size-4"
            icon={PlusSignIcon}
            strokeWidth={1.5}
          />
        </Button>
      )}
    </div>
  );
}
