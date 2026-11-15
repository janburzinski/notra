"use client";

import {
  Clock01Icon,
  Delete02Icon,
  Globe02Icon,
  LinkSquare02Icon,
  MoreHorizontalIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { artifactPath } from "@notra/ai/utils/artifact-path";
import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import { Button } from "@notra/ui/components/ui/button";
import { CopyButton } from "@notra/ui/components/ui/copy-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@notra/ui/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@notra/ui/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { Slack } from "@notra/ui/components/ui/svgs/slack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "use-intl";

import { dashboardOrpc } from "@/lib/orpc/query";
import { cn } from "@/lib/utils";
import type { ArtifactActionsProps } from "@/types/artifacts";
import { toastCopyError, writeClipboardText } from "@/utils/copy-to-clipboard";
import { toErrorMessage } from "@/utils/error-message";

type ShareAccess = "team" | "public";

function ArtifactSharePopover({
  organizationId,
  organizationName,
  artifact,
}: Pick<
  ArtifactActionsProps,
  "organizationId" | "organizationName" | "artifact"
>) {
  const t = useTranslations("artifacts.share");
  const queryClient = useQueryClient();
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const access: ShareAccess = artifact.sharePath ? "public" : "team";
  const url = `${origin}${artifact.sharePath ?? artifactPath(artifact.id)}`;
  let published: "latest" | "behind" | null = null;
  if (artifact.sharePath && artifact.shareVersion) {
    published =
      artifact.shareVersion === artifact.currentVersion ? "latest" : "behind";
  }

  const setShared = useMutation({
    mutationFn: (shared: boolean) =>
      dashboardOrpc.artifacts.setShared.call({
        organizationId,
        artifactId: artifact.id,
        shared,
      }),
    onSuccess: async ({ sharePath, shareVersion }) => {
      const republished = Boolean(artifact.sharePath);
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.artifacts.key(),
      });
      if (!sharePath) {
        toast.success(t("revoked"));
        return;
      }
      if (republished) {
        toast.success(t("republished", { version: shareVersion ?? 0 }));
        return;
      }
      try {
        await writeClipboardText(`${origin}${sharePath}`);
        toast.success(t("createdAndCopied"));
      } catch {
        toast.success(t("created"));
      }
    },
    onError: (error, shared) =>
      toast.error(
        toErrorMessage(error, shared ? t("publishFailed") : t("revokeFailed"))
      ),
  });

  const options = [
    {
      value: "team",
      label: t("access.team", { organization: organizationName }),
    },
    { value: "public", label: t("access.public") },
  ] satisfies { value: ShareAccess; label: string }[];

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            className="active:scale-100"
            size="sm"
            type="button"
            variant="outline"
          />
        }
      >
        <HugeiconsIcon
          className="size-4"
          icon={Globe02Icon}
          strokeWidth={1.8}
        />
        {t("button")}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80"
        initialFocus={false}
        sideOffset={6}
      >
        <div className="flex flex-col gap-2 p-1">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">{t("title")}</p>
            <Select
              disabled={setShared.isPending}
              items={options}
              onValueChange={(next) => {
                if (next !== access) {
                  setShared.mutate(next === "public");
                }
              }}
              value={access}
            >
              <SelectTrigger
                aria-label={t("accessLabel")}
                className="-ml-2.5 max-w-full"
                variant="ghost"
              >
                <HugeiconsIcon
                  className="text-muted-foreground size-4 shrink-0"
                  icon={access === "public" ? Globe02Icon : UserGroupIcon}
                />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start" className="w-auto">
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <InputGroup>
            <InputGroupInput
              aria-label={t("linkLabel")}
              // A long link fades out before the copy button instead of
              // being cut off mid-character.
              className="mask-r-from-80%"
              onFocus={(event) => event.currentTarget.select()}
              readOnly
              value={url}
            />
            <InputGroupAddon align="inline-end">
              <CopyButton
                aria-label={t("copy")}
                copiedAriaLabel={t("copied")}
                onCopyError={toastCopyError}
                size="icon-xs"
                value={url}
                variant="ghost"
              />
            </InputGroupAddon>
          </InputGroup>
          {published === "latest" ? (
            <p className="text-muted-foreground text-xs">{t("showsLatest")}</p>
          ) : null}
          {published === "behind" ? (
            <Button
              className="self-start"
              disabled={setShared.isPending}
              onClick={() => setShared.mutate(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("publishLatest", { version: artifact.currentVersion })}
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ArtifactVersionMenu({
  artifact,
  onPickVersion,
  align = "end",
}: Pick<ArtifactActionsProps, "artifact"> & {
  /** Version picked in the menu; the current one when null. */
  onPickVersion: (version: number | null) => void;
  align?: "start" | "end";
}) {
  const t = useTranslations("artifacts");
  const format = useFormatter();
  if (artifact.versions.length < 2) {
    return null;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className="active:scale-100"
            size="sm"
            type="button"
            variant="ghost"
          />
        }
      >
        {/* One group, so the icon sits closer to the number than the
            button's own gap would put it. */}
        <span className="flex items-center gap-1">
          <HugeiconsIcon
            className="size-3.5"
            icon={Clock01Icon}
            strokeWidth={2}
          />
          <span className="tabular-nums">
            {t("versionShort", { version: artifact.version })}
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-64" sideOffset={6}>
        {artifact.versions.map((entry) => (
          <DropdownMenuItem
            key={entry.version}
            onClick={() =>
              onPickVersion(
                entry.version === artifact.currentVersion ? null : entry.version
              )
            }
          >
            <span
              className={cn(
                "flex-1 tabular-nums",
                entry.version === artifact.version
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              )}
            >
              {t("version", { version: entry.version })}
            </span>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {entry.version === artifact.currentVersion
                ? t("latest")
                : format.dateTime(new Date(entry.createdAt), {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Everything a member can do with an artifact: share it, open it on its own
 * page or in the chat that made it, delete it. The version menu sits beside
 * it wherever the host puts it.
 */
export function ArtifactActions({
  organizationId,
  organizationSlug,
  organizationName,
  artifact,
  onDeleted,
  showOpenPage = false,
}: ArtifactActionsProps) {
  const t = useTranslations("artifacts");
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const showOpenChat = !showOpenPage && Boolean(artifact.chatId);
  const showLinks = showOpenPage || showOpenChat || Boolean(artifact.slackUrl);
  const remove = useMutation({
    mutationFn: () =>
      dashboardOrpc.artifacts.delete.call({
        organizationId,
        artifactId: artifact.id,
      }),
    onSuccess: async () => {
      setConfirmDelete(false);
      toast.success(t("deleted"));
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.artifacts.key(),
      });
      onDeleted?.();
    },
    onError: (error) => toast.error(toErrorMessage(error, t("deleteFailed"))),
  });

  return (
    <div className="flex shrink-0 items-center gap-1">
      <ArtifactSharePopover
        artifact={artifact}
        organizationId={organizationId}
        organizationName={organizationName}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              className="active:scale-100"
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <span className="sr-only">{t("more")}</span>
          <HugeiconsIcon className="size-4" icon={MoreHorizontalIcon} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48" sideOffset={6}>
          {showOpenPage ? (
            <DropdownMenuItem
              render={
                // react-doctor-disable-next-line react-doctor/anchor-has-content -- Base UI renders the item's icon and label inside this link
                <a
                  href={artifactPath(artifact.id)}
                  rel="noreferrer"
                  target="_blank"
                />
              }
            >
              <HugeiconsIcon icon={LinkSquare02Icon} />
              {t("openPage")}
            </DropdownMenuItem>
          ) : null}
          {showOpenChat ? (
            <DropdownMenuItem
              render={
                // react-doctor-disable-next-line react-doctor/anchor-has-content -- Base UI renders the item's icon and label inside this link
                <a href={`/${organizationSlug}/chat/${artifact.chatId}`} />
              }
            >
              <HugeiconsIcon icon={LinkSquare02Icon} />
              {t("openChat")}
            </DropdownMenuItem>
          ) : null}
          {artifact.slackUrl ? (
            <DropdownMenuItem
              render={
                // react-doctor-disable-next-line react-doctor/anchor-has-content -- Base UI renders the item's icon and label inside this link
                <a href={artifact.slackUrl} rel="noreferrer" target="_blank" />
              }
            >
              <Slack className="size-4" />
              {t("openSlack")}
            </DropdownMenuItem>
          ) : null}
          {/* The line only separates Delete from a link above it. */}
          {showLinks ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem
            onClick={() => setConfirmDelete(true)}
            variant="destructive"
          >
            <HugeiconsIcon icon={Delete02Icon} />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        confirmLabel={t("delete")}
        description={t("deleteDescription")}
        onConfirm={() => remove.mutateAsync()}
        onOpenChange={setConfirmDelete}
        open={confirmDelete}
        pending={remove.isPending}
        title={t("deleteTitle")}
        variant="destructive"
      />
    </div>
  );
}
