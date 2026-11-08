"use client";

import { Checkbox } from "@notra/ui/components/ui/checkbox";
import { type ReactNode, useState } from "react";
import { useTranslations } from "use-intl";

import { CodeSnippet } from "@/components/geo/code-snippet";
import { GeoSetupStep } from "@/components/geo/geo-setup-step";
import { GeoWebTrackingStatus } from "@/components/geo/geo-web-tracking-status";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import type { GeoIngestScriptSetupProps } from "@/types/geo";
import { geoScriptSnippet } from "@/utils/geo-ingest";

const code = (chunks: ReactNode) => (
  <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
    {chunks}
  </code>
);

export function GeoIngestScriptSetup({
  setup,
  onCopy,
}: GeoIngestScriptSetupProps) {
  const t = useTranslations("geo.geoIngestSetup.script");
  const { activeOrganization } = useOrganizationsContext();
  const [pinned, setPinned] = useState(false);
  const [errors, setErrors] = useState(false);
  const snippet = geoScriptSnippet(setup, { pinned, errors });

  if (!snippet) {
    return (
      <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5 text-sm">
        {t("notConfigured")}
      </p>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ol>
        <GeoSetupStep
          index={1}
          plain
          title={t.rich("tagTitle", { code, tag: "<head>" })}
        >
          <CodeSnippet code={snippet} onCopy={onCopy} variant="block" wrap />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {/* biome-ignore lint/a11y/noLabelWithoutControl: the checkbox inside is the control */}
            <label className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox
                checked={pinned}
                onCheckedChange={(next) => setPinned(next === true)}
              />
              {t("pinLabel")}
            </label>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: the checkbox inside is the control */}
            <label className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox
                checked={errors}
                onCheckedChange={(next) => setErrors(next === true)}
              />
              {t("errorsLabel")}
            </label>
          </div>
          {pinned ? (
            <p className="text-muted-foreground text-xs text-pretty">
              {t("pinNote")}
            </p>
          ) : null}
          {errors ? (
            <p className="text-muted-foreground text-xs text-pretty">
              {t.rich("errorsNote", { code })}
            </p>
          ) : null}
        </GeoSetupStep>
        <GeoSetupStep index={2} plain title={t("checkTitle")} />
      </ol>
      {activeOrganization ? (
        <GeoWebTrackingStatus organizationId={activeOrganization.id} />
      ) : null}
    </div>
  );
}
