"use client";

import { Delete02Icon, Edit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ContextMenuItem,
  ContextMenuSeparator,
} from "@notra/ui/components/ui/context-menu";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@notra/ui/components/ui/dropdown-menu";
import { useTranslations } from "use-intl";

export function ApiKeyMenuItems({
  disabled,
  onEdit,
  onDelete,
  variant,
}: {
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
  variant: "context" | "dropdown";
}) {
  const t = useTranslations("apiKeys.shared");
  const Item = variant === "context" ? ContextMenuItem : DropdownMenuItem;
  const Separator =
    variant === "context" ? ContextMenuSeparator : DropdownMenuSeparator;
  return (
    <>
      <Item disabled={disabled} onClick={onEdit}>
        <HugeiconsIcon className="size-4" icon={Edit02Icon} />
        {t("editApiKey")}
      </Item>
      <Separator />
      <Item disabled={disabled} onClick={onDelete} variant="destructive">
        <HugeiconsIcon className="size-4" icon={Delete02Icon} />
        {t("deleteApiKey")}
      </Item>
    </>
  );
}
