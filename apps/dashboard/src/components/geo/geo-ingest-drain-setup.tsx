"use client";

import {
  GEO_CLOUDFLARE_LOGPUSH_FIELDS,
  GEO_DRAIN_DASHBOARD_URLS,
} from "@notra/geo-core/constants/geo";
import { CopyButton } from "@notra/ui/components/ui/copy-button";
import { Cloudflare } from "@notra/ui/components/ui/svgs/cloudflare";
import { Vercel } from "@notra/ui/components/ui/svgs/vercel";
import { useTranslations } from "use-intl";

import { GeoExternalLinkButton } from "@/components/geo/geo-external-link-button";
import { GeoSetupCopyField } from "@/components/geo/geo-setup-copy-field";
import { GeoSetupStep } from "@/components/geo/geo-setup-step";
import { GEO_SETUP_MASKED_TOKEN } from "@/constants/geo-ingest-setup";
import type {
  GeoIngestDrainSetupProps,
  GeoLogpushFieldListProps,
} from "@/types/geo";
import { toastCopyError } from "@/utils/copy-to-clipboard";
import {
  geoCloudflareDestination,
  geoVercelDrainHeader,
  withoutProtocol,
} from "@/utils/geo-ingest";

function LogpushFieldList({ label, onCopy }: GeoLogpushFieldListProps) {
  const tCommon = useTranslations("common");
  return (
    <div className="bg-muted/40 relative rounded-lg border py-2.5 ps-3 pe-10">
      <ul className="grid grid-cols-1 gap-x-4 gap-y-1 font-mono text-xs sm:grid-cols-2">
        {GEO_CLOUDFLARE_LOGPUSH_FIELDS.map((field) => (
          <li className="truncate" key={field}>
            {field}
          </li>
        ))}
      </ul>
      <CopyButton
        aria-label={tCommon("labels.copyLabel", { label })}
        className="text-muted-foreground absolute end-1 top-1"
        onCopy={onCopy}
        onCopyError={toastCopyError}
        value={GEO_CLOUDFLARE_LOGPUSH_FIELDS.join(", ")}
      />
    </div>
  );
}

function CloudflareSteps({
  setup,
  onCopy,
}: Omit<GeoIngestDrainSetupProps, "provider">) {
  const t = useTranslations("geo.geoIngestSetup.drains.cloudflare");
  const token = setup?.token ?? "";
  return (
    <ol>
      <GeoSetupStep
        action={
          <GeoExternalLinkButton
            href={GEO_DRAIN_DASHBOARD_URLS.cloudflare}
            icon={<Cloudflare aria-hidden="true" className="h-3 w-auto" />}
            label={t("openAction")}
          />
        }
        description={t("openDescription")}
        index={1}
        title={t("openTitle")}
      />
      <GeoSetupStep index={2} title={t("destinationTitle")}>
        {token ? (
          <GeoSetupCopyField
            display={withoutProtocol(
              geoCloudflareDestination(setup, GEO_SETUP_MASKED_TOKEN)
            )}
            label={t("destinationTitle")}
            onCopy={onCopy}
            value={geoCloudflareDestination(setup, token)}
          />
        ) : null}
      </GeoSetupStep>
      <GeoSetupStep
        description={t("fieldsDescription", {
          count: GEO_CLOUDFLARE_LOGPUSH_FIELDS.length,
        })}
        index={3}
        title={t("fieldsTitle")}
      >
        <LogpushFieldList label={t("fieldsTitle")} onCopy={onCopy} />
        <p className="text-muted-foreground text-xs text-pretty">
          {t("customFieldsNote")}
        </p>
      </GeoSetupStep>
      <GeoSetupStep
        description={t("saveDescription")}
        index={4}
        title={t("saveTitle")}
      />
    </ol>
  );
}

function VercelSteps({
  setup,
  onCopy,
}: Omit<GeoIngestDrainSetupProps, "provider">) {
  const t = useTranslations("geo.geoIngestSetup.drains.vercel");
  const token = setup?.token ?? "";
  const endpoint = setup?.drainUrls?.vercel ?? "";
  return (
    <ol>
      <GeoSetupStep
        action={
          <GeoExternalLinkButton
            href={GEO_DRAIN_DASHBOARD_URLS.vercel}
            icon={<Vercel aria-hidden="true" className="size-3" />}
            label={t("openAction")}
          />
        }
        description={t("openDescription")}
        index={1}
        title={t("openTitle")}
      />
      <GeoSetupStep
        description={t("projectsDescription")}
        index={2}
        title={t("projectsTitle")}
      />
      <GeoSetupStep
        description={t("endpointDescription")}
        index={3}
        title={t("endpointTitle")}
      >
        {endpoint ? (
          <GeoSetupCopyField
            display={withoutProtocol(endpoint)}
            label={t("endpointTitle")}
            onCopy={onCopy}
            value={endpoint}
          />
        ) : null}
      </GeoSetupStep>
      <GeoSetupStep index={4} title={t("headerTitle")}>
        {token ? (
          <GeoSetupCopyField
            display={geoVercelDrainHeader(GEO_SETUP_MASKED_TOKEN)}
            label={t("headerTitle")}
            onCopy={onCopy}
            value={geoVercelDrainHeader(token)}
          />
        ) : null}
      </GeoSetupStep>
    </ol>
  );
}

export function GeoIngestDrainSetup({
  provider,
  setup,
  onCopy,
}: GeoIngestDrainSetupProps) {
  return provider === "vercel" ? (
    <VercelSteps onCopy={onCopy} setup={setup} />
  ) : (
    <CloudflareSteps onCopy={onCopy} setup={setup} />
  );
}
