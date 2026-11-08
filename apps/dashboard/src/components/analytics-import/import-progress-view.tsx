"use client";

import { Alert02Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type ReactNode, useMemo } from "react";
import { useFormatter, useTranslations } from "use-intl";

import {
  ANALYTICS_IMPORT_KNOWN_ERRORS,
  ANALYTICS_IMPORT_PROVIDER_BRANDS,
} from "@/constants/analytics-imports";
import { useImportChunkLabel } from "@/lib/hooks/use-import-chunk-label";
import { useNow } from "@/lib/hooks/use-now";
import type { ImportProgressViewProps } from "@/types/components/analytics-import";
import {
  importProgressModel,
  importProgressView,
  secondsUntil,
} from "@/utils/analytics-import-progress";
import { formatImportDay } from "@/utils/analytics-imports";

import { PixelOctopus } from "./pixel-octopus";

const ICONS = {
  stopped: { icon: Alert02Icon, className: "text-destructive" },
  deleted: { icon: Delete02Icon, className: "text-muted-foreground" },
} as const;

/**
 * One import, from "Start import" until it's done, stopped or deleted: a
 * little pixel octopus sways while it runs and cheers when it's done, above
 * a title and one line on where it is.
 */
export function ImportProgressView({ item }: ImportProgressViewProps) {
  const t = useTranslations("geo.analyticsImport");
  const format = useFormatter();
  const chunkLabel = useImportChunkLabel();
  const model = useMemo(() => importProgressModel(item), [item]);
  const now = useNow(model.phase === "waiting");
  const date = (day: string | null) =>
    day ? formatImportDay(format, day) : null;
  const view = importProgressView(item, model, {
    // An export's chunks are parts of one file, not periods worth naming.
    period: model.unit === "part" ? null : chunkLabel(model.current),
    provider: ANALYTICS_IMPORT_PROVIDER_BRANDS[item.provider],
    seconds: secondsUntil(item.retryAt, now),
    startDate: date(item.startDay),
    endDate: date(item.endDay),
  });
  const knownError = item.lastError
    ? ANALYTICS_IMPORT_KNOWN_ERRORS[item.lastError]
    : undefined;
  let detail = view.detail
    .map((part) =>
      "text" in part ? part.text : t(`progress.${part.key}`, part.values)
    )
    .join(" · ");
  if (view.showError) {
    detail = knownError
      ? t(`list.errors.${knownError}`)
      : (item.lastError ?? "");
  }
  let art: ReactNode = null;
  if (view.mascot) {
    art = <PixelOctopus dance={view.mascot} />;
  } else if (view.icon) {
    art = (
      <HugeiconsIcon
        className={`size-5 ${ICONS[view.icon].className}`}
        icon={ICONS[view.icon].icon}
      />
    );
  }

  return (
    <div className="flex flex-col items-center px-6 py-8 text-center">
      <span aria-hidden="true" className="flex min-h-14 items-end">
        {art}
      </span>
      {/* Only the title is announced: it changes with the phase, not every chunk or second. */}
      <p
        aria-live="polite"
        className="mt-4 text-sm font-medium text-pretty tabular-nums"
        role="status"
      >
        {t(`progress.${view.title.key}`, view.title.values)}
      </p>
      {detail ? (
        <p className="text-muted-foreground mt-1 text-sm text-pretty tabular-nums">
          {detail}
        </p>
      ) : null}
    </div>
  );
}
