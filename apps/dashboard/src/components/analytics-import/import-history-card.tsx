"use client";

import { useId, useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { useAnalyticsImports } from "@/lib/hooks/use-analytics-imports";
import { useGeoActiveProject } from "@/lib/hooks/use-geo-active-project";
import type { ImportHistoryCardProps } from "@/types/components/analytics-import";

import { AnalyticsImportDialog } from "./analytics-import-dialog";
import { ImportActivityPill } from "./import-activity-pill";
import { ImportProviderMark } from "./import-provider-mark";

const CARD_PROVIDERS = ["plausible", "vercel", "cloudflare"] as const;

function ImportProviderMarks() {
  return (
    <div aria-hidden="true" className="flex shrink-0 -space-x-2">
      {CARD_PROVIDERS.map((provider) => (
        <ImportProviderMark
          className="bg-background ring-background size-8 rounded-lg border ring-2"
          key={provider}
          provider={provider}
        />
      ))}
    </div>
  );
}

/**
 * Import history from Plausible, Vercel or Cloudflare: a call to action in
 * the empty web analytics page until the project has an import, and a
 * section of the GEO tracking settings. Without web analytics it only shows
 * up when something was imported or connected, so it can be removed.
 */
export function ImportHistoryCard({
  variant = "cta",
  manageOnly = false,
}: ImportHistoryCardProps) {
  const t = useTranslations("geo.analyticsImport");
  const { activeOrganization } = useOrganizationsContext();
  const organizationId = activeOrganization?.id ?? "";
  const { project, domain } = useGeoActiveProject(organizationId);
  const projectId = project?.id ?? null;
  const { data } = useAnalyticsImports(organizationId, projectId);
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const importCount = data?.imports.length ?? 0;
  const storedCount = importCount + (data?.connections.length ?? 0);
  const hidden =
    variant === "cta" ? importCount > 0 : manageOnly && storedCount === 0;
  if (hidden) {
    return null;
  }
  const dialog = (
    <AnalyticsImportDialog
      defaultHost={domain ?? ""}
      manageOnly={manageOnly}
      onOpenChange={setOpen}
      open={open}
      organizationId={organizationId}
      projectId={projectId}
      trigger={
        <Button className="shrink-0" size="sm" variant="outline">
          {t(`${variant}.action`)}
        </Button>
      }
    />
  );

  if (variant === "settings") {
    return (
      <section
        aria-labelledby={headingId}
        className="bg-background flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center"
      >
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <h2 className="text-base font-semibold" id={headingId}>
            {t("settings.title")}
          </h2>
          <p className="text-muted-foreground text-sm text-pretty">
            {manageOnly
              ? t("settings.manageDescription")
              : t("settings.description")}
          </p>
          <ImportActivityPill
            imports={data?.imports ?? []}
            onOpen={() => setOpen(true)}
          />
        </div>
        <div className="self-start sm:self-auto">{dialog}</div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:gap-4">
      <ImportProviderMarks />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium">{t("cta.title")}</p>
        <p className="text-muted-foreground text-sm text-pretty">
          {t("cta.description")}
        </p>
      </div>
      <div className="self-start sm:self-auto">{dialog}</div>
    </div>
  );
}
