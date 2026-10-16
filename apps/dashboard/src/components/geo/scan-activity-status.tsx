import { Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Progress } from "@notra/ui/components/ui/progress";
import { useLocale, useTranslations } from "use-intl";

import { useFormatRelative } from "@/lib/hooks/use-format-relative";
import type { GeoScanActivityStatusProps } from "@/types/geo-scan-activity";
import { geoRunProgress } from "@/utils/geo-scan-activity";

/** One line above the answers table: what this scan is and how far it got. */
export function ScanActivityStatus({
  run,
  starting,
}: GeoScanActivityStatusProps) {
  const t = useTranslations("geo.scanActivityStatus");
  const formatRelative = useFormatRelative();
  const locale = useLocale();
  if (run.status === "running") {
    const total = run.plan?.totalChecks ?? null;
    return (
      <div className="flex min-w-0 items-center gap-3 text-sm">
        <span className="text-foreground inline-flex shrink-0 items-center gap-2 font-medium">
          <HugeiconsIcon
            aria-hidden="true"
            className="text-primary motion-safe:animate-spin"
            icon={Loading03Icon}
            size={14}
          />
          {t("running")}
        </span>
        {total ? (
          <>
            <Progress
              aria-label={t("progressLabel")}
              className="w-32 shrink-0"
              value={geoRunProgress(run)}
            />
            <span className="text-muted-foreground truncate tabular-nums">
              {t("answered", {
                checks: run.checks.toLocaleString(locale),
                total: total.toLocaleString(locale),
              })}
            </span>
          </>
        ) : null}
      </div>
    );
  }
  if (starting) {
    return (
      <p className="text-foreground inline-flex min-w-0 items-center gap-2 text-sm font-medium">
        <HugeiconsIcon
          aria-hidden="true"
          className="text-primary shrink-0 motion-safe:animate-spin"
          icon={Loading03Icon}
          size={14}
        />
        {t("starting")}
      </p>
    );
  }
  const when = formatRelative(run.finishedAt ?? run.startedAt);
  if (run.status === "failed") {
    return (
      <p className="text-muted-foreground min-w-0 truncate text-sm">
        {t("failed", { when })}
      </p>
    );
  }
  return (
    <p className="min-w-0 truncate text-sm">
      <span className="text-foreground font-medium">
        {t("completed", { when })}
      </span>
      <span className="text-muted-foreground tabular-nums">
        {" · "}
        {t("summary", {
          answers: run.checks,
          mentions: run.mentions.toLocaleString(locale),
        })}
      </span>
    </p>
  );
}
