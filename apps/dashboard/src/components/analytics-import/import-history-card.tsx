"use client";

import { useId, useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { useAnalyticsImports } from "@/lib/hooks/use-analytics-imports";
import { useGeoActiveProject } from "@/lib/hooks/use-geo-active-project";
import { cn } from "@/lib/utils";
import type { ImportHistoryCardProps } from "@/types/components/analytics-import";

import { AnalyticsImportDialog } from "./analytics-import-dialog";
import { ImportActivityPill } from "./import-activity-pill";
import { ImportProviderLogo } from "./import-provider-mark";

// Vercel stands in front; Plausible and Cloudflare stand behind it, a little
// smaller and turned outwards.
const TILE_CLASSNAME =
  "bg-background flex shrink-0 items-center justify-center rounded-lg border";

function ImportProviderMarks() {
  return (
    <div aria-hidden="true" className="flex shrink-0 items-center">
      <span className={cn(TILE_CLASSNAME, "-me-1.5 size-9 -rotate-8")}>
        <ImportProviderLogo className="h-4 w-auto" provider="plausible" />
      </span>
      <span className={cn(TILE_CLASSNAME, "relative z-10 size-11 shadow-sm")}>
        <ImportProviderLogo className="size-4.5" provider="vercel" />
      </span>
      <span className={cn(TILE_CLASSNAME, "-ms-1.5 size-9 rotate-8")}>
        <ImportProviderLogo className="h-auto w-5" provider="cloudflare" />
      </span>
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
  onOpen,
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
  const settings = variant === "settings";
  const actionLabel = settings
    ? t(storedCount > 0 ? "settings.action" : "settings.start")
    : t("cta.action");
  const button = (
    <Button className="shrink-0" onClick={onOpen} size="sm" variant="outline">
      {actionLabel}
    </Button>
  );
  // A page that holds its own import dialog gets just the button, so the
  // dialog stays open when this card leaves with the page's empty state.
  const dialog = onOpen ? (
    button
  ) : (
    <AnalyticsImportDialog
      defaultHost={domain ?? ""}
      manageOnly={manageOnly}
      onOpenChange={setOpen}
      open={open}
      organizationId={organizationId}
      projectId={projectId}
      trigger={button}
    />
  );
  const card = (
    <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:gap-4">
      <ImportProviderMarks />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {manageOnly ? null : (
          <p className="text-sm font-medium">{t("cta.title")}</p>
        )}
        <p className="text-muted-foreground text-sm text-pretty">
          {settings
            ? t(
                manageOnly
                  ? "settings.manageDescription"
                  : "settings.description"
              )
            : t("cta.description")}
        </p>
      </div>
      <div className="self-start sm:self-auto">{dialog}</div>
    </div>
  );

  if (!settings) {
    return card;
  }

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col items-start gap-4 border-t pt-6"
    >
      <h2 className="text-base font-semibold" id={headingId}>
        {t("settings.title")}
      </h2>
      <div className="w-full">{card}</div>
      <ImportActivityPill
        imports={data?.imports ?? []}
        onOpen={() => setOpen(true)}
      />
    </section>
  );
}
