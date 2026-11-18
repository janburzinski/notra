"use client";

import { ContextMenuItem } from "@notra/ui/components/ui/context-menu";
import { useTranslations } from "use-intl";

import { copyTextToClipboard } from "@/utils/copy-to-clipboard";

export function RowDetailsMenuItems({
  onOpen,
  copyId,
}: {
  onOpen: () => void;
  copyId?: string | null;
}) {
  const t = useTranslations("common");
  return (
    <>
      <ContextMenuItem onClick={onOpen}>
        {t("actions.viewDetails")}
      </ContextMenuItem>
      {copyId ? (
        <ContextMenuItem
          onClick={() => copyTextToClipboard(copyId, t("toasts.copied"))}
        >
          {t("actions.copyId")}
        </ContextMenuItem>
      ) : null}
    </>
  );
}
