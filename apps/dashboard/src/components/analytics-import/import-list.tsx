"use client";

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import { StatusBadge } from "@notra/ui/components/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { Progress } from "@notra/ui/components/ui/progress";
import { useState } from "react";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "use-intl";

import { Button } from "@/components/button";
import {
  ANALYTICS_IMPORT_KNOWN_ERRORS,
  ANALYTICS_IMPORT_PROVIDER_LABELS,
  ANALYTICS_IMPORT_STATUS_BADGES,
} from "@/constants/analytics-imports";
import { useAnalyticsImportMutations } from "@/lib/hooks/use-analytics-imports";
import { cn } from "@/lib/utils";
import type {
  ImportConnectionRowProps,
  ImportListProps,
  ImportRowMenuProps,
  ImportRowPartProps,
  ImportRowProps,
} from "@/types/components/analytics-import";
import {
  formatImportDay,
  importProgress,
  isImportActive,
} from "@/utils/analytics-imports";
import { toErrorMessage } from "@/utils/error-message";

import { ImportFrame } from "./import-frame";
import { ImportProviderMark } from "./import-provider-mark";

const LIST_CLASS = "divide-table-row-border divide-y";
const ROW_CLASS = "group/row flex items-start gap-3 px-3 py-2.5";

function ImportRowMenu({ label, disabled, children }: ImportRowMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <Button
            aria-label={label}
            className="-me-1 shrink-0"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <HugeiconsIcon icon={MoreHorizontalIcon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ImportRowSummary({ item }: ImportRowPartProps) {
  const t = useTranslations("geo.analyticsImport.list");
  const format = useFormatter();
  const date = (day: string) => formatImportDay(format, day);
  const completed = item.status === "completed";
  let note: string | null = null;
  if (completed && item.capabilities.sampled) {
    note = t("sampled");
  } else if (completed && !item.capabilities.visits) {
    note = t("missing");
  }
  const meta = [
    ANALYTICS_IMPORT_PROVIDER_LABELS[item.provider],
    item.startDay && item.endDay
      ? t("range", { start: date(item.startDay), end: date(item.endDay) })
      : null,
    item.pageviewsImported > 0
      ? t(item.kind === "geo" ? "requests" : "pageviews", {
          count: item.pageviewsImported,
        })
      : null,
    note,
  ].filter(Boolean);

  return (
    <p className="text-muted-foreground text-xs text-pretty tabular-nums">
      {meta.join(" · ")}
    </p>
  );
}

function ImportRowProgress({ item }: ImportRowPartProps) {
  const t = useTranslations("geo.analyticsImport.list");
  const format = useFormatter();
  const total = Math.max(item.chunksTotal, 1);
  let label: string;
  if (item.waitingFor) {
    label = t("queued", { source: item.waitingFor });
  } else if (item.status === "waiting_rate_limit" && item.retryAt) {
    label = t("waiting", { time: format.relativeTime(new Date(item.retryAt)) });
  } else {
    label = t("progress", {
      done: Math.min(item.chunksDone + 1, total),
      total,
    });
  }

  return (
    // Clicks pass through to the row's button, which covers the whole row.
    <div className="pointer-events-none mt-1.5 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <Progress
        aria-label={label}
        className="sm:flex-1"
        value={importProgress(item.chunksDone, item.chunksTotal)}
      />
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {label}
      </span>
    </div>
  );
}

function ImportRow({
  item,
  organizationId,
  canManage,
  onOpen,
}: ImportRowProps) {
  const t = useTranslations("geo.analyticsImport.list");
  const { remove } = useAnalyticsImportMutations(organizationId);
  const [confirming, setConfirming] = useState(false);
  const badge = ANALYTICS_IMPORT_STATUS_BADGES[item.status];
  const knownError = item.lastError
    ? ANALYTICS_IMPORT_KNOWN_ERRORS[item.lastError]
    : undefined;
  const openable = isImportActive(item.status) && onOpen;

  return (
    <li
      className={cn(
        ROW_CLASS,
        openable && "hover:bg-muted/50 relative transition-colors duration-150"
      )}
    >
      <ImportProviderMark provider={item.provider} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          {openable ? (
            // Covers the whole row, so the row opens the import's progress.
            <button
              className="focus-visible:after:ring-ring/50 cursor-pointer truncate text-start text-sm font-medium outline-none after:absolute after:inset-0 group-first/row:after:rounded-t-xl group-last/row:after:rounded-b-xl focus-visible:after:ring-3 focus-visible:after:ring-inset"
              onClick={() => onOpen(item)}
              type="button"
            >
              {item.host}
              <span className="sr-only"> · {t("open")}</span>
            </button>
          ) : (
            <span className="truncate text-sm font-medium">{item.host}</span>
          )}
          {badge ? (
            <StatusBadge
              appearance={badge}
              label={t(`status.${item.status}`)}
            />
          ) : null}
        </div>
        <ImportRowSummary item={item} />
        {isImportActive(item.status) ? <ImportRowProgress item={item} /> : null}
        {item.status === "failed" && item.lastError ? (
          <p className="text-destructive text-xs text-pretty">
            {knownError ? t(`errors.${knownError}`) : item.lastError}
          </p>
        ) : null}
      </div>
      {canManage ? (
        <>
          <ImportRowMenu
            disabled={item.status === "deleting" || remove.isPending}
            label={t("actions", { name: item.host })}
          >
            <DropdownMenuItem
              onClick={() => setConfirming(true)}
              variant="destructive"
            >
              {t("delete")}
            </DropdownMenuItem>
          </ImportRowMenu>
          <ConfirmDialog
            confirmLabel={t("delete")}
            description={t("deleteDescription")}
            onConfirm={() =>
              remove.mutateAsync(item.id).then(
                () => {
                  setConfirming(false);
                  toast.success(t("deleted"));
                },
                (error: unknown) =>
                  toast.error(toErrorMessage(error, t("deleteFailed")))
              )
            }
            onOpenChange={setConfirming}
            open={confirming}
            title={t("deleteTitle", { name: item.host })}
            variant="destructive"
          />
        </>
      ) : null}
    </li>
  );
}

function ImportConnectionRow({
  connection,
  organizationId,
  canManage,
  onReconnect,
  onUse,
}: ImportConnectionRowProps) {
  const t = useTranslations("geo.analyticsImport.list");
  const format = useFormatter();
  const { disconnect } = useAnalyticsImportMutations(organizationId);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const providerName = ANALYTICS_IMPORT_PROVIDER_LABELS[connection.provider];
  const connectedOn = t("connectedOn", {
    date: format.dateTime(new Date(connection.createdAt), {
      dateStyle: "medium",
    }),
  });
  const needsReauth = connection.status === "reauth_required";
  const usable = !needsReauth && onUse;
  const remove = (deleteImports: boolean) =>
    disconnect.mutateAsync({ connectionId: connection.id, deleteImports }).then(
      () => {
        setConfirmingDelete(false);
        toast.success(t("disconnected"));
      },
      (error: unknown) =>
        toast.error(toErrorMessage(error, t("disconnectFailed")))
    );

  return (
    // One line: accounts are upkeep, the imports above are the point.
    <li
      className={cn(
        "group/row flex items-center gap-3 px-3 py-2",
        usable && "hover:bg-muted/50 relative transition-colors duration-150"
      )}
    >
      <ImportProviderMark provider={connection.provider} />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {usable ? (
          // Covers the whole row, so the row starts an import with this account.
          <button
            className="focus-visible:after:ring-ring/50 shrink-0 cursor-pointer text-start text-sm font-medium outline-none after:absolute after:inset-0 group-first/row:after:rounded-t-xl group-last/row:after:rounded-b-xl focus-visible:after:ring-3 focus-visible:after:ring-inset"
            onClick={() => onUse(connection)}
            type="button"
          >
            {connection.label}
            <span className="sr-only"> · {t("use")}</span>
          </button>
        ) : (
          <span className="shrink-0 text-sm font-medium">
            {connection.label}
          </span>
        )}
        {needsReauth ? (
          <StatusBadge
            appearance={{ variant: "warning" }}
            label={t("reauth")}
          />
        ) : null}
        <span className="text-muted-foreground min-w-0 truncate text-xs">
          {connection.label === providerName
            ? connectedOn
            : `${providerName} · ${connectedOn}`}
        </span>
      </div>
      {canManage ? (
        <>
          <ImportRowMenu
            disabled={disconnect.isPending}
            label={t("actions", { name: connection.label })}
          >
            {usable ? (
              <DropdownMenuItem onClick={() => onUse(connection)}>
                {t("use")}
              </DropdownMenuItem>
            ) : null}
            {needsReauth && onReconnect ? (
              <DropdownMenuItem onClick={() => onReconnect(connection)}>
                {t("reconnect")}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={() => remove(false)}>
              {t("disconnect")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setConfirmingDelete(true)}
              variant="destructive"
            >
              {t("disconnectAndDelete")}
            </DropdownMenuItem>
          </ImportRowMenu>
          <ConfirmDialog
            confirmLabel={t("disconnectAndDelete")}
            description={t("disconnectAndDeleteDescription")}
            onConfirm={() => remove(true)}
            onOpenChange={setConfirmingDelete}
            open={confirmingDelete}
            title={t("disconnectAndDeleteTitle", { name: connection.label })}
            variant="destructive"
          />
        </>
      ) : null}
    </li>
  );
}

export function ImportList({
  organizationId,
  canManage,
  imports,
  connections,
  onReconnect,
  onOpen,
  onUse,
}: ImportListProps) {
  const t = useTranslations("geo.analyticsImport.list");

  return (
    <>
      {imports.length > 0 ? (
        <ImportFrame title={t("title")}>
          <ul className={LIST_CLASS}>
            {imports.map((item) => (
              <ImportRow
                canManage={canManage}
                item={item}
                key={item.id}
                onOpen={onOpen}
                organizationId={organizationId}
              />
            ))}
          </ul>
        </ImportFrame>
      ) : null}
      {connections.length > 0 ? (
        <ImportFrame title={t("connections")}>
          <ul className={LIST_CLASS}>
            {connections.map((connection) => (
              <ImportConnectionRow
                canManage={canManage}
                connection={connection}
                key={connection.id}
                onReconnect={onReconnect}
                onUse={onUse}
                organizationId={organizationId}
              />
            ))}
          </ul>
        </ImportFrame>
      ) : null}
    </>
  );
}
