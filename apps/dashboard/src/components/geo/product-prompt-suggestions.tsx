"use client";

import {
  Cancel01Icon,
  PlusSignIcon,
  Refresh03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { GeoProductSuggestion } from "@notra/geo-core/types/suggestions";
import { StatusBadge } from "@notra/ui/components/status-badge";
import { Spinner } from "@notra/ui/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { useEffect, useRef, useState } from "react";
import { DataTable, type TableColumn } from "ui/table";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { ProductSuggestionSheet } from "@/components/geo/product-suggestion-sheet";
import { useGeoProjectScope } from "@/components/providers/geo-project-provider";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import {
  useGeoProductSuggestionAction,
  useGeoProductSuggestions,
  useGeoProductSuggestionsGenerate,
} from "@/lib/hooks/use-geo";
import type { ProductPromptSuggestionsProps } from "@/types/components/geo";
import { geoProductBadgeVariant } from "@/utils/geo-prompts";
import { tableHeightFor } from "@/utils/table";

/**
 * New prompts written for each of the project's products, below the tracked
 * prompts. Shows one per product so the list stays short; tracking or
 * dismissing one brings up that product's next suggestion.
 * Suggestions are written the first time a project with products opens this
 * list, and again on Refresh.
 */
export function ProductPromptSuggestions({
  organizationId,
}: ProductPromptSuggestionsProps) {
  const t = useTranslations("geo.productSuggestions");
  const tGeoShared = useTranslations("geo.shared");
  const { projectId } = useGeoProjectScope();
  const { data } = useGeoProductSuggestions(organizationId);
  const generate = useGeoProductSuggestionsGenerate(organizationId);
  const action = useGeoProductSuggestionAction(organizationId);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set());
  const startedFor = useRef<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const products = data?.products ?? [];
  const suggestions = data?.suggestions ?? [];
  const neverGenerated = !!data && products.length > 0 && !data.generatedAt;
  const { mutate: startGenerate } = generate;

  useEffect(() => {
    const key = projectId ?? "default";
    if (!neverGenerated || startedFor.current === key) {
      return;
    }
    startedFor.current = key;
    startGenerate();
  }, [neverGenerated, projectId, startGenerate]);

  if (products.length === 0) {
    return null;
  }

  const run = (suggestionId: string, kind: "track" | "dismiss") => {
    if (busyIds.has(suggestionId)) {
      return;
    }
    setBusyIds((current) => new Set(current).add(suggestionId));
    action.mutate(
      { suggestionId, action: kind },
      {
        onSettled: () =>
          setBusyIds((current) => {
            const next = new Set(current);
            next.delete(suggestionId);
            return next;
          }),
      }
    );
  };

  const generating = generate.isPending;
  const productsById = new Map(
    products.map((product) => [product.id, product])
  );
  // Closes on its own once the open suggestion is tracked or dismissed.
  const detail = suggestions.find((row) => row.id === detailId) ?? null;
  // The oldest pending suggestion of each product, in product order.
  const visible = products.flatMap((product) => {
    const first = suggestions.find((row) => row.productId === product.id);
    return first ? [first] : [];
  });

  const columns: TableColumn<GeoProductSuggestion>[] = [
    {
      key: "prompt",
      header: t("suggestion"),
      minWidth: "16rem",
      width: "1fr",
      cell: (row) => (
        <span className="block truncate text-sm font-medium">{row.prompt}</span>
      ),
    },
    {
      key: "product",
      header: t("product"),
      width: "14rem",
      cell: (row) => {
        const product = productsById.get(row.productId);
        return product ? (
          <StatusBadge
            appearance={{ variant: geoProductBadgeVariant(product.position) }}
            label={product.name}
          />
        ) : null;
      },
    },
    {
      key: "actions",
      align: "right",
      header: "",
      minWidth: "9.5rem",
      width: "9.5rem",
      cell: (row) => {
        const busy = busyIds.has(row.id);
        return (
          <div
            className="flex h-full shrink-0 items-center justify-end gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            <Button
              aria-busy={busy}
              disabled={busy || generating}
              onClick={() => run(row.id, "track")}
              size="sm"
              variant="secondary"
            >
              {busy ? (
                <Spinner className="size-3.5" />
              ) : (
                <HugeiconsIcon
                  className="-translate-y-px"
                  icon={PlusSignIcon}
                  size={14}
                />
              )}
              {tGeoShared("track")}
            </Button>
            <Button
              aria-label={t("dismiss", { prompt: row.prompt })}
              disabled={busy || generating}
              onClick={() => run(row.id, "dismiss")}
              size="icon-sm"
              variant="ghost"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={14} />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <section
      aria-busy={generating}
      aria-labelledby="product-suggestions-title"
      className="space-y-3 pt-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2
            className="text-base font-semibold tracking-tight"
            id="product-suggestions-title"
          >
            {t("title")}
          </h2>
          <p className="text-muted-foreground text-sm text-pretty">
            {generating ? t("generating") : t("description")}
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-busy={generating}
                disabled={generating}
                onClick={() => generate.mutate()}
                size="sm"
                variant="outline"
              >
                {generating ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <HugeiconsIcon icon={Refresh03Icon} size={14} />
                )}
                {generating ? t("refreshing") : t("refresh")}
              </Button>
            }
          />
          <TooltipContent>{t("refreshHint")}</TooltipContent>
        </Tooltip>
      </div>
      <DataTable
        columns={columns}
        data={visible}
        emptyState={t("empty")}
        getRowId={(row) => row.id}
        height={tableHeightFor(Math.max(visible.length, generating ? 3 : 1))}
        loading={generating && visible.length === 0}
        onRowClick={(row) => setDetailId(row.id)}
        rowHeight={TABLE_ROW_HEIGHT}
      />
      <ProductSuggestionSheet
        busy={detail ? busyIds.has(detail.id) || generating : false}
        onDismiss={() => detail && run(detail.id, "dismiss")}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null);
          }
        }}
        onTrack={() => detail && run(detail.id, "track")}
        product={detail ? (productsById.get(detail.productId) ?? null) : null}
        suggestion={detail}
      />
    </section>
  );
}
