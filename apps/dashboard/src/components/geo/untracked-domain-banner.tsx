"use client";

import { Alert02Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { GEO_MAX_DOMAINS } from "@notra/geo-core/constants/geo";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@notra/ui/components/ui/alert";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import {
  useGeoRejectedHostDismiss,
  useGeoRejectedHosts,
  useGeoSettings,
  useGeoTrackedDomainAdd,
} from "@/lib/hooks/use-geo";
import type {
  TrafficUntrackedDomainBannerProps,
  UntrackedDomainBannerProps,
} from "@/types/geo";

export function UntrackedDomainBanner({
  hosts,
  onAdd,
  onDismiss,
  addDisabled = false,
  atDomainLimit = false,
}: UntrackedDomainBannerProps) {
  const t = useTranslations("geo.untrackedDomainBanner");
  const [host, ...others] = hosts;
  if (!host) {
    return null;
  }
  return (
    <Alert variant="warning">
      <HugeiconsIcon aria-hidden="true" icon={Alert02Icon} strokeWidth={1.5} />
      <AlertTitle>{t("title", { domain: host })}</AlertTitle>
      <AlertDescription>
        <div>
          {t("description")}
          {others.length > 0
            ? ` ${t("moreDomains", { count: others.length })}`
            : null}
          {atDomainLimit
            ? ` ${t("domainLimit", { max: GEO_MAX_DOMAINS })}`
            : null}
        </div>
        <Button
          className="mt-3"
          disabled={addDisabled || atDomainLimit}
          onClick={() => onAdd(host)}
          size="sm"
        >
          {t("add", { domain: host })}
        </Button>
      </AlertDescription>
      <AlertAction>
        <Button
          aria-label={t("dismiss", { domain: host })}
          onClick={() => onDismiss(host)}
          size="icon-sm"
          variant="ghost"
        >
          <HugeiconsIcon icon={Cancel01Icon} />
        </Button>
      </AlertAction>
    </Alert>
  );
}

/** Banner wired to the one-click tracked-domain mutation, for traffic views. */
export function TrafficUntrackedDomainBanner({
  organizationId,
}: TrafficUntrackedDomainBannerProps) {
  const { data } = useGeoRejectedHosts(organizationId);
  const { data: settings } = useGeoSettings(organizationId);
  const add = useGeoTrackedDomainAdd(organizationId);
  const dismiss = useGeoRejectedHostDismiss(organizationId);
  return (
    <UntrackedDomainBanner
      addDisabled={add.isPending}
      atDomainLimit={
        (settings?.settings?.domains.length ?? 0) >= GEO_MAX_DOMAINS
      }
      hosts={data?.hosts ?? []}
      onAdd={(host) => add.mutate(host)}
      onDismiss={(host) => dismiss.mutate(host)}
    />
  );
}
