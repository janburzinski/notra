"use client";

import {
  ArrowTurnBackwardIcon,
  ArrowUpRight01Icon,
  Copy01Icon,
  Delete02Icon,
  Link04Icon,
  MoreHorizontalIcon,
  RefreshIcon,
  ViewIcon,
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
import { useRouter } from "@/lib/navigation";
import type { SiteDeploymentMenuProps } from "@/types/components/sites";
import { copyTextToClipboard } from "@/utils/copy-to-clipboard";
import { isDeploymentInProgress, shortSha } from "@/utils/site-deployments";

export function SiteDeploymentMenu({
  deployment,
  canRollback,
  canPromote,
  canUndoRollback,
  canRedeploy,
  detailHref,
  redeployPending,
  onRedeploy,
  onRollback,
  onPromote,
  preview,
  onOpenPreview,
  onCopyShareLink,
  onDeletePreview,
  variant = "dropdown",
}: SiteDeploymentMenuProps & { variant?: "context" | "dropdown" }) {
  const t = useTranslations("sites.deployments.actions");
  const tPage = useTranslations("sites.deploymentsPage.actions");
  const tPreview = useTranslations("sites.previewsPage");
  const router = useRouter();
  const finished = !isDeploymentInProgress(deployment.status);
  const Item = variant === "context" ? ContextMenuItem : DropdownMenuItem;
  const Separator =
    variant === "context" ? ContextMenuSeparator : DropdownMenuSeparator;
  const items = (
    <>
      {detailHref ? (
        <Item onClick={() => router.push(detailHref)}>
          <HugeiconsIcon icon={ViewIcon} size={14} strokeWidth={1.75} />
          {t("view")}
        </Item>
      ) : null}
      {deployment.live && (deployment.kind === "production" || preview) ? (
        <>
          <Item
            onClick={() =>
              preview && onOpenPreview
                ? onOpenPreview()
                : window.open(deployment.url, "_blank", "noopener,noreferrer")
            }
          >
            <HugeiconsIcon
              icon={ArrowUpRight01Icon}
              size={14}
              strokeWidth={1.75}
            />
            {t("visit")}
          </Item>
          <Item
            onClick={() =>
              preview?.visibility === "protected" && onCopyShareLink
                ? onCopyShareLink()
                : copyTextToClipboard(deployment.url, tPage("copied"))
            }
          >
            <HugeiconsIcon
              icon={
                preview?.visibility === "protected" ? Link04Icon : Copy01Icon
              }
              size={14}
              strokeWidth={1.75}
            />
            {preview?.visibility === "protected"
              ? tPreview("copyShareLink")
              : tPage("copyUrl")}
          </Item>
        </>
      ) : null}
      {finished &&
      (canRedeploy || canRollback || canPromote || canUndoRollback) &&
      (detailHref || deployment.live) ? (
        <Separator />
      ) : null}
      {finished && canRedeploy ? (
        <Item disabled={redeployPending} onClick={onRedeploy}>
          <HugeiconsIcon icon={RefreshIcon} size={14} strokeWidth={1.75} />
          {t("redeploy")}
        </Item>
      ) : null}
      {canRollback ? (
        <Item onClick={onRollback}>
          <HugeiconsIcon
            icon={ArrowTurnBackwardIcon}
            size={14}
            strokeWidth={1.75}
          />
          {t("rollback")}
        </Item>
      ) : null}
      {canPromote || canUndoRollback ? (
        <Item onClick={onPromote}>
          <HugeiconsIcon
            icon={ArrowTurnBackwardIcon}
            size={14}
            strokeWidth={1.75}
          />
          {t(canUndoRollback ? "undoRollback" : "promote")}
        </Item>
      ) : null}
      {preview?.served && onDeletePreview ? (
        <>
          <Separator />
          <Item onClick={onDeletePreview} variant="destructive">
            <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={1.75} />
            {tPreview("delete")}
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
            aria-label={t("label", { sha: shortSha(deployment.commitSha) })}
            size="icon-sm"
            variant="ghost-muted"
          />
        }
      >
        <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {items}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
