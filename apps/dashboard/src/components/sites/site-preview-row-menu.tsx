"use client";

import {
  ArrowUpRight01Icon,
  Delete02Icon,
  Link04Icon,
  MoreHorizontalIcon,
  Rocket01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ContextMenuItem,
  ContextMenuSeparator,
} from "@notra/ui/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import type { SitePreviewRowMenuProps } from "@/types/components/sites";
import { copyTextToClipboard } from "@/utils/copy-to-clipboard";

export function SitePreviewRowMenu({
  row,
  onCopyShareLink,
  onOpenPreview,
  onViewDeployment,
  onDelete,
  variant = "dropdown",
}: SitePreviewRowMenuProps & { variant?: "context" | "dropdown" }) {
  const t = useTranslations("sites.previewsPage");
  const tCommon = useTranslations("common");
  const Item = variant === "context" ? ContextMenuItem : DropdownMenuItem;
  const Separator =
    variant === "context" ? ContextMenuSeparator : DropdownMenuSeparator;
  const items = (
    <>
      {onOpenPreview ? (
        <Item disabled={!row.served} onClick={onOpenPreview}>
          <HugeiconsIcon
            icon={ArrowUpRight01Icon}
            size={14}
            strokeWidth={1.5}
          />
          {t("open")}
        </Item>
      ) : null}
      {row.visibility === "protected" ? (
        <Item disabled={!row.served} onClick={onCopyShareLink}>
          <HugeiconsIcon icon={Link04Icon} size={14} strokeWidth={1.5} />
          {t("copyShareLink")}
        </Item>
      ) : (
        <Item
          disabled={!row.served}
          onClick={() => copyTextToClipboard(row.url, tCommon("toasts.copied"))}
        >
          <HugeiconsIcon icon={Link04Icon} size={14} strokeWidth={1.5} />
          {t("copyLink")}
        </Item>
      )}
      <Item onClick={onViewDeployment}>
        <HugeiconsIcon icon={Rocket01Icon} size={14} strokeWidth={1.5} />
        {t("viewDeployment")}
      </Item>
      {row.served && onDelete ? (
        <>
          <Separator />
          <Item onClick={onDelete} variant="destructive">
            <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={1.5} />
            {t("delete")}
          </Item>
        </>
      ) : null}
    </>
  );

  if (variant === "context") {
    return items;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={t("actionsLabel", {
              name: row.branch ?? row.previewKey,
            })}
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {items}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
