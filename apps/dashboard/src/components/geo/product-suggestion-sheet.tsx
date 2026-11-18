"use client";

import { StatusBadge } from "@notra/ui/components/status-badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetScrollArea,
  SheetTitle,
} from "@notra/ui/components/ui/sheet";
import { Spinner } from "@notra/ui/components/ui/spinner";
import { useRetainedValue } from "@notra/ui/hooks/use-retained-value";
import { useMemo } from "react";
import { InstrumentModule } from "ui/card";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { useGeoPromptIntentLabel } from "@/lib/hooks/use-geo-prompt-intent-label";
import type { ProductSuggestionSheetProps } from "@/types/components/geo";
import { geoProductBadgeVariant } from "@/utils/geo-prompts";

/** A product suggestion in full: its product, intent and why it was written. */
export function ProductSuggestionSheet({
  suggestion,
  product,
  busy,
  onTrack,
  onDismiss,
  onOpenChange,
}: ProductSuggestionSheetProps) {
  const t = useTranslations("geo.productSuggestions");
  const tGeoShared = useTranslations("geo.shared");
  const tLabels = useTranslations("common.labels");
  const intentLabel = useGeoPromptIntentLabel();
  const payload = useMemo(
    () => (suggestion ? { suggestion, product } : null),
    [suggestion, product]
  );
  const [retained, releasePayload] = useRetainedValue(payload);
  const detail = retained?.suggestion;
  const detailProduct = retained?.product;

  return (
    <Sheet
      onOpenChange={onOpenChange}
      onOpenChangeComplete={releasePayload}
      open={suggestion !== null}
    >
      <SheetContent
        className="data-[side=right]:w-[calc(100%-1rem)] data-[side=right]:sm:max-w-xl"
        side="right"
        variant="inset"
      >
        <SheetHeader className="bg-muted/50 shrink-0 gap-1.5 border-b pr-14">
          <SheetDescription>{t("suggestedPrompt")}</SheetDescription>
          <SheetTitle className="leading-snug text-balance wrap-anywhere">
            {detail?.prompt ?? t("suggestedPrompt")}
          </SheetTitle>
        </SheetHeader>

        {detail ? (
          <SheetScrollArea
            className="bg-muted/20 min-h-full p-4 sm:px-4"
            key={detail.id}
          >
            <div className="space-y-4">
              <InstrumentModule
                eyebrow={tLabels("overview")}
                variant="table-compact"
              >
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div className="min-w-0 space-y-1.5">
                    <dt className="text-muted-foreground text-xs">
                      {t("product")}
                    </dt>
                    <dd className="space-y-1">
                      {detailProduct ? (
                        <StatusBadge
                          appearance={{
                            variant: geoProductBadgeVariant(
                              detailProduct.position
                            ),
                          }}
                          label={detailProduct.name}
                        />
                      ) : null}
                      {detailProduct?.niche ? (
                        <p className="text-muted-foreground text-sm text-pretty">
                          {detailProduct.niche}
                        </p>
                      ) : null}
                    </dd>
                  </div>
                  {detail.intent ? (
                    <div className="min-w-0 space-y-1.5">
                      <dt className="text-muted-foreground text-xs">
                        {tLabels("intent")}
                      </dt>
                      <dd className="text-sm font-medium">
                        {intentLabel(detail.intent)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </InstrumentModule>

              {detail.reason ? (
                <InstrumentModule eyebrow={t("why")} variant="table-compact">
                  <p className="text-sm leading-relaxed text-pretty">
                    {detail.reason}
                  </p>
                </InstrumentModule>
              ) : null}
            </div>
          </SheetScrollArea>
        ) : null}

        <SheetFooter className="shrink-0 flex-row flex-wrap justify-end border-t">
          <Button disabled={busy} onClick={onDismiss} variant="outline">
            {t("dismissAction")}
          </Button>
          <Button aria-busy={busy} disabled={busy} onClick={onTrack}>
            {busy ? <Spinner className="size-3.5" /> : null}
            {tGeoShared("track")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
