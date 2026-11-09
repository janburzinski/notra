"use client";

import {
  CheckmarkCircle02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ResponsiveDialogFooter } from "@notra/ui/components/shared/responsive-dialog";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@notra/ui/components/ui/toggle-group";
import { useFormatter, useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { ANALYTICS_IMPORT_PROVIDER_LABELS } from "@/constants/analytics-imports";
import type {
  ImportOverlapChoiceProps,
  ImportPreviewEmptyProps,
  ImportPreviewFooterProps,
  ImportPreviewPageviewsProps,
  ImportPreviewProps,
} from "@/types/components/analytics-import";
import { formatImportDay, previewRange } from "@/utils/analytics-imports";

import { ImportFrame } from "./import-frame";

const ROW_CLASS =
  "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3.5 py-2.5";
const OVERLAP_MODES = ["skip", "add"] as const;

/**
 * Days another source already has for this domain, and whether to skip
 * them (the same site tracked twice) or add both counts (two sites merged).
 */
function ImportOverlapChoice({
  preview,
  overlap,
  onOverlapChange,
}: ImportOverlapChoiceProps) {
  const t = useTranslations("geo.analyticsImport.preview");
  const format = useFormatter();
  const date = (day: string) => formatImportDay(format, day);
  return (
    <div className="flex flex-col gap-2.5 px-3.5 py-3">
      <ul className="flex flex-col gap-1 text-sm text-pretty">
        {preview.overlaps.map((item) => {
          const values = {
            host: item.host,
            range: t("range", {
              start: date(item.startDay),
              end: date(item.endDay),
            }),
            source: ANALYTICS_IMPORT_PROVIDER_LABELS[item.provider],
            label: item.sourceLabel,
          };
          return (
            <li className="tabular-nums" key={item.importId}>
              {item.sourceLabel === item.host
                ? t("overlap", values)
                : t("overlapNamed", values)}
            </li>
          );
        })}
      </ul>
      <ToggleGroup
        aria-label={t("overlapChoice")}
        onValueChange={(next) => {
          const mode = OVERLAP_MODES.find((item) => item === next[0]);
          if (mode) {
            onOverlapChange(mode);
          }
        }}
        size="sm"
        spacing={0.5}
        value={[overlap]}
        variant="segmented"
      >
        {OVERLAP_MODES.map((mode) => (
          <ToggleGroupItem key={mode} value={mode}>
            {mode === "skip" ? t("overlapSkip") : t("overlapAdd")}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-muted-foreground text-xs text-pretty">
        {overlap === "skip" ? t("overlapSkipHint") : t("overlapAddHint")}
      </p>
    </div>
  );
}

/** Nothing left to import: this source already has the days, or Notra or another import does. */
function ImportPreviewEmpty({ alreadyImported }: ImportPreviewEmptyProps) {
  const t = useTranslations("geo.analyticsImport.preview");
  return (
    <ImportFrame
      icon={
        <HugeiconsIcon
          aria-hidden="true"
          className="text-muted-foreground size-3.5 shrink-0"
          icon={InformationCircleIcon}
          strokeWidth={2}
        />
      }
      role="status"
      title={alreadyImported ? t("alreadyImportedTitle") : t("emptyTitle")}
    >
      <p className="text-muted-foreground px-3.5 py-3 text-sm text-pretty">
        {alreadyImported ? t("alreadyImported") : t("empty")}
      </p>
    </ImportFrame>
  );
}

/** The estimate for the chosen days, or a note when the source can't count ahead. */
function ImportPreviewPageviews({
  kind,
  pageviews,
}: ImportPreviewPageviewsProps) {
  const t = useTranslations("geo.analyticsImport.preview");
  return (
    <div className={ROW_CLASS}>
      <dt className="text-muted-foreground">
        {kind === "geo" ? t("requestsLabel") : t("pageviewsLabel")}
      </dt>
      <dd
        className={
          pageviews === null
            ? "text-muted-foreground"
            : "font-medium tabular-nums"
        }
      >
        {pageviews === null
          ? t("unknownPageviews")
          : t("pageviews", { count: pageviews })}
      </dd>
    </div>
  );
}

export function ImportPreview({
  preview,
  overlap,
  onOverlapChange,
}: ImportPreviewProps) {
  const t = useTranslations("geo.analyticsImport.preview");
  const format = useFormatter();
  const date = (day: string) => formatImportDay(format, day);
  const range = previewRange(preview, overlap);

  if (preview.overlaps.length === 0 && !(range.startDay && range.endDay)) {
    return <ImportPreviewEmpty alreadyImported={preview.alreadyImported} />;
  }

  return (
    <ImportFrame
      aria-live="polite"
      footer={
        <>
          {preview.nativeStartDay
            ? t("cutoff", { date: date(preview.nativeStartDay) })
            : t("noNative")}
          {/* Without other sources, only this source's own days clip it. */}
          {range.clipped && preview.overlaps.length === 0
            ? ` ${t("clipped")}`
            : null}
        </>
      }
      icon={
        <HugeiconsIcon
          aria-hidden="true"
          className="text-success size-3.5 shrink-0"
          icon={CheckmarkCircle02Icon}
          strokeWidth={2}
        />
      }
      role="status"
      title={t("title")}
    >
      <dl className="divide-table-row-border divide-y text-sm">
        <div className={ROW_CLASS}>
          <dt className="text-muted-foreground">{t("period")}</dt>
          {range.startDay && range.endDay ? (
            <dd className="font-medium tabular-nums">
              {t("range", {
                start: date(range.startDay),
                end: date(range.endDay),
              })}
              <span className="text-muted-foreground font-normal">
                {" · "}
                {t("months", { count: range.months })}
              </span>
            </dd>
          ) : (
            <dd className="text-muted-foreground">{t("noNewDays")}</dd>
          )}
        </div>
        {range.startDay ? (
          <ImportPreviewPageviews
            kind={preview.kind}
            pageviews={range.pageviews}
          />
        ) : null}
      </dl>
      {preview.overlaps.length > 0 ? (
        <div className="border-table-row-border border-t">
          <ImportOverlapChoice
            onOverlapChange={onOverlapChange}
            overlap={overlap}
            preview={preview}
          />
        </div>
      ) : null}
    </ImportFrame>
  );
}

/** One primary action: check first, then start once there is something to import. */
export function ImportPreviewFooter({
  preview,
  overlap,
  checkLabel,
  canCheck,
  checking,
  starting,
  onCheck,
  onStart,
}: ImportPreviewFooterProps) {
  const t = useTranslations("geo.analyticsImport.preview");
  const ready = Boolean(preview && previewRange(preview, overlap).startDay);
  // With other sources' days on screen, the choice decides; checking again changes nothing.
  const choosing = Boolean(preview && preview.overlaps.length > 0);
  return (
    <ResponsiveDialogFooter>
      {ready || choosing ? (
        <Button
          data-dialog-confirm
          disabled={!ready}
          loading={starting}
          onClick={onStart}
        >
          {t("start")}
        </Button>
      ) : (
        <Button
          data-dialog-confirm
          disabled={!canCheck}
          loading={checking}
          onClick={onCheck}
        >
          {checkLabel}
        </Button>
      )}
    </ResponsiveDialogFooter>
  );
}
