"use client";

import { Cancel01Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/button";
import { SearchConsoleToolbar } from "@/components/geo/search-console-card";
import { StatusSpinner } from "@/components/geo/status-spinner";
import { Table, type TableColumn } from "@/components/motion/table";
import { TruncateWithTooltip } from "@/components/truncate-with-tooltip";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import {
  useGeoSuggestionAccept,
  useGeoSuggestionDismiss,
  useGeoSuggestions,
  useGeoSuggestionsAcceptAll,
  useGscAnalyzing,
  useGscCardDismissal,
  useGscStatus,
} from "@/lib/hooks/use-geo";
import type {
  PromptSuggestionsProps,
  SuggestionRowActionsProps,
} from "@/types/components/geo";
import type { GeoPromptSuggestion } from "@/types/geo";
import { tableHeightFor } from "@/utils/table";

function totalImpressions(suggestion: GeoPromptSuggestion): number {
  return suggestion.keywords.reduce(
    (total, keyword) => total + keyword.impressions,
    0
  );
}

function totalClicks(suggestion: GeoPromptSuggestion): number {
  return suggestion.keywords.reduce(
    (total, keyword) => total + keyword.clicks,
    0
  );
}

function bestPosition(suggestion: GeoPromptSuggestion): number | null {
  if (suggestion.keywords.length === 0) {
    return null;
  }
  return Math.min(...suggestion.keywords.map((keyword) => keyword.position));
}

function SuggestionRowActions({
  accepting,
  disabled,
  onAccept,
  organizationId,
  suggestion,
}: SuggestionRowActionsProps) {
  const dismiss = useGeoSuggestionDismiss(organizationId);
  const busy = disabled || dismiss.isPending;

  return (
    <div className="flex items-center justify-end gap-1">
      <Button disabled={busy} onClick={onAccept} size="sm" variant="outline">
        {accepting ? (
          <StatusSpinner />
        ) : (
          <HugeiconsIcon icon={PlusSignIcon} size={14} />
        )}
        {accepting ? "Adding…" : "Track"}
      </Button>
      <Button
        aria-label={`Dismiss ${suggestion.prompt}`}
        disabled={busy}
        onClick={() => dismiss.mutate({ suggestionId: suggestion.id })}
        size="icon-sm"
        variant="ghost"
      >
        <HugeiconsIcon icon={Cancel01Icon} size={16} />
      </Button>
    </div>
  );
}

export function PromptSuggestions({
  organizationId,
  callbackPath,
}: PromptSuggestionsProps) {
  const { data } = useGeoSuggestions(organizationId);
  const { data: searchConsoleStatus, isPending: isSearchConsolePending } =
    useGscStatus(organizationId);
  const { dismiss, dismissed } = useGscCardDismissal(organizationId);
  const checking = useGscAnalyzing(organizationId);
  const accept = useGeoSuggestionAccept(organizationId);
  const acceptAll = useGeoSuggestionsAcceptAll(organizationId);
  const suggestions = data?.suggestions ?? [];
  const hasSuggestions = suggestions.length > 0;
  const acceptingSuggestionId = accept.isPending
    ? accept.variables?.suggestionId
    : undefined;
  const trackingDisabled = accept.isPending || acceptAll.isPending;
  const connectPromo =
    !isSearchConsolePending &&
    searchConsoleStatus !== undefined &&
    !searchConsoleStatus.connected;
  const showSearchConsole = !(
    dismissed &&
    (isSearchConsolePending || !searchConsoleStatus || connectPromo)
  );

  const columns: TableColumn<GeoPromptSuggestion>[] = [
    {
      key: "prompt",
      header: (
        <span className="inline-flex items-center gap-1.5">
          Suggested prompt
          <span className="text-muted-foreground font-normal tabular-nums">
            ({suggestions.length})
          </span>
        </span>
      ),
      minWidth: "18rem",
      sortable: true,
      width: "1.5fr",
      cell: (row) => (
        <TruncateWithTooltip className="font-medium">
          {row.prompt}
        </TruncateWithTooltip>
      ),
    },
    {
      key: "queries",
      header: "Search queries",
      minWidth: "12rem",
      sortable: true,
      width: "1fr",
      cell: (row) => (
        <TruncateWithTooltip className="text-muted-foreground">
          {row.keywords.map((keyword) => keyword.query).join(", ") || "-"}
        </TruncateWithTooltip>
      ),
      sortValue: (row) =>
        row.keywords.map((keyword) => keyword.query).join(", "),
    },
    {
      key: "impressions",
      align: "right",
      header: "Impressions",
      sortable: true,
      width: "8.5rem",
      cell: (row) => (
        <span className="text-muted-foreground tabular-nums">
          {totalImpressions(row).toLocaleString()}
        </span>
      ),
      sortValue: totalImpressions,
    },
    {
      key: "clicks",
      align: "right",
      header: "Clicks",
      sortable: true,
      width: "6.5rem",
      cell: (row) => (
        <span className="text-muted-foreground tabular-nums">
          {totalClicks(row).toLocaleString()}
        </span>
      ),
      sortValue: totalClicks,
    },
    {
      key: "position",
      align: "right",
      header: "Best position",
      sortable: true,
      width: "8rem",
      cell: (row) => {
        const position = bestPosition(row);
        return (
          <span className="text-muted-foreground tabular-nums">
            {position === null ? "-" : position.toFixed(1)}
          </span>
        );
      },
      sortValue: (row) => bestPosition(row) ?? Number.MAX_SAFE_INTEGER,
    },
    {
      key: "actions",
      align: "right",
      header: "",
      minWidth: "8.5rem",
      width: "8.5rem",
      cell: (row) => (
        <SuggestionRowActions
          accepting={acceptingSuggestionId === row.id}
          disabled={checking || trackingDisabled}
          onAccept={() => accept.mutate({ suggestionId: row.id })}
          organizationId={organizationId}
          suggestion={row}
        />
      ),
    },
  ];

  if (!(checking || hasSuggestions || showSearchConsole)) {
    return null;
  }

  const trackAllAction =
    !checking && suggestions.length > 1 ? (
      <Button
        disabled={trackingDisabled}
        onClick={() => acceptAll.mutate()}
        size="sm"
        variant="outline"
      >
        {acceptAll.isPending ? (
          <StatusSpinner />
        ) : (
          <HugeiconsIcon icon={PlusSignIcon} size={14} />
        )}
        {acceptAll.isPending ? "Adding…" : `Track all (${suggestions.length})`}
      </Button>
    ) : null;

  const toolbar = showSearchConsole ? (
    <SearchConsoleToolbar
      action={trackAllAction}
      callbackPath={callbackPath}
      isPending={isSearchConsolePending}
      onDismiss={connectPromo ? dismiss : undefined}
      organizationId={organizationId}
      status={searchConsoleStatus}
    />
  ) : (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          {checking ? <StatusSpinner /> : null}
          <p className="text-sm leading-snug font-medium">Suggested prompts</p>
        </div>
        <p className="text-muted-foreground text-xs leading-snug">
          Based on queries your site already ranks for
        </p>
      </div>
      {trackAllAction}
    </div>
  );

  return (
    <section aria-busy={checking} aria-label="Suggested prompts">
      <Table
        className="rounded-2xl"
        columns={columns}
        data={suggestions}
        defaultSort={{ key: "impressions", direction: "desc" }}
        emptyState="No Google Search suggestions yet"
        getRowId={(row) => row.id}
        height={tableHeightFor(Math.max(suggestions.length, checking ? 3 : 1))}
        loading={checking && !hasSuggestions}
        resizable
        rowHeight={TABLE_ROW_HEIGHT}
        toolbar={toolbar}
      />
    </section>
  );
}
