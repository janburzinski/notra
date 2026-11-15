"use client";

import { useFormatter, useTranslations } from "use-intl";

/** The line above an artifact's title: what it is, its date and version. */
export function ArtifactEyebrow({
  source,
  date,
  version,
}: {
  source: string;
  date: Date;
  /** Shown once there is more than one version. */
  version?: number | null;
}) {
  const t = useTranslations("artifacts");
  const format = useFormatter();
  return (
    <>
      <span className="text-foreground font-medium">
        {t(source === "autopilot" ? "dailyBrief" : "label")}
      </span>
      <span aria-hidden="true" className="bg-border h-3.5 w-px" />
      <time dateTime={date.toISOString()}>
        {format.dateTime(date, { dateStyle: "medium" })}
      </time>
      {version ? (
        <>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{t("version", { version })}</span>
        </>
      ) : null}
    </>
  );
}
