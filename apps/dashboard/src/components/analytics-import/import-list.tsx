"use client";

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { StatusBadge } from "@notra/ui/components/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { Progress } from "@notra/ui/components/ui/progress";
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
        <ImportRowMenu
          disabled={item.status === "deleting" || remove.isPending}
          label={t("actions", { name: item.host })}
        >
          <DropdownMenuItem
            onClick={() =>
              remove.mutate(item.id, {
                onSuccess: () => toast.success(t("deleted")),
                onError: (error) =>
                  toast.error(toErrorMessage(error, t("deleteFailed"))),
              })
            }
            variant="destructive"
          >
            {t("delete")}
          </DropdownMenuItem>
        </ImportRowMenu>
      ) : null}
    </li>
  );
}

function ImportConnectionRow({
  connection,
  organizationId,
  canManage,
  onReconnect,
}: ImportConnectionRowProps) {
  const t = useTranslations("geo.analyticsImport.list");
  const format = useFormatter();
  const { disconnect } = useAnalyticsImportMutations(organizationId);
  const providerName = ANALYTICS_IMPORT_PROVIDER_LABELS[connection.provider];
  const connectedOn = t("connectedOn", {
    date: format.dateTime(new Date(connection.createdAt), {
      dateStyle: "medium",
    }),
  });
  const needsReauth = connection.status === "reauth_required";
  const remove = (deleteImports: boolean) =>
    disconnect.mutate(
      { connectionId: connection.id, deleteImports },
      {
        onSuccess: () => toast.success(t("disconnected")),
        onError: (error) =>
          toast.error(toErrorMessage(error, t("disconnectFailed"))),
      }
    );

  return (
    // One line: accounts are upkeep, the imports above are the point.
    <li className="flex items-center gap-3 px-3 py-2">
      <ImportProviderMark provider={connection.provider} />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-sm font-medium">{connection.label}</span>
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
        <ImportRowMenu
          disabled={disconnect.isPending}
          label={t("actions", { name: connection.label })}
        >
          {needsReauth && onReconnect ? (
            <DropdownMenuItem onClick={() => onReconnect(connection)}>
              {t("reconnect")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => remove(false)}>
            {t("disconnect")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => remove(true)} variant="destructive">
            {t("disconnectAndDelete")}
          </DropdownMenuItem>
        </ImportRowMenu>
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
                organizationId={organizationId}
              />
            ))}
          </ul>
        </ImportFrame>
      ) : null}
    </>
  );
}
