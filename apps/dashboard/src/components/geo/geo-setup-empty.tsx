"use client";

import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { useEffect, useRef } from "react";
import { useTranslations } from "use-intl";

import { EmptyState } from "@/components/empty-state";
import { EmptyStateAnalyticsPreview } from "@/components/empty-state-preview";
import { GeoSetupButton } from "@/components/geo/geo-setup-button";
import { trackEvent } from "@/lib/analytics/posthog-client";
import type { GeoSetupEmptyProps } from "@/types/geo";

export function GeoSetupEmpty({ organizationId, page }: GeoSetupEmptyProps) {
  const t = useTranslations("geo.geoSetupEmpty");
  const viewedRef = useRef(false);

  useEffect(() => {
    if (viewedRef.current) {
      return;
    }
    viewedRef.current = true;
    trackEvent(POSTHOG_EVENTS.GEO_SETUP_EMPTY_VIEWED, { page: page ?? null });
  }, [page]);

  return (
    <EmptyState
      action={
        <GeoSetupButton organizationId={organizationId} size="sm">
          {t("action")}
        </GeoSetupButton>
      }
      description={t("description")}
      preview={<EmptyStateAnalyticsPreview />}
      title={t("title")}
    />
  );
}
