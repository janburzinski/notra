"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { PLANS } from "@notra/ai/billing/features";
import { AUTOPILOT_AUTOMATION_KINDS } from "@notra/db/constants/autopilot";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { StatusBadge } from "@notra/ui/components/status-badge";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { AutopilotUpgradeSection } from "@/components/autopilot/autopilot-upgrade-section";
import { GeoUpgradeDialog } from "@/components/billing/geo-upgrade-dialog";
import { PlanBadge } from "@/components/billing/plan-badge";
import { Button, buttonVariants } from "@/components/button";
import { PAYWALL_KINDS } from "@/constants/analytics-events";
import {
  AUTOPILOT_LEARN_MORE_URL,
  AUTOPILOT_NAV_LINK,
} from "@/constants/autopilot";
import {
  AUTOPILOT_AUTOMATIONS,
  AUTOPILOT_KIND_META,
  AUTOPILOT_UPGRADE_COPY,
  AUTOPILOT_UPGRADE_EXAMPLES,
} from "@/constants/autopilot-ui";
import { FEATURED_PLAN_TIER, PLAN_TIER_LIMITS } from "@/constants/billing";
import { CONTENT_PULL_REQUEST_BADGES } from "@/constants/content-overview";
import { trackEvent } from "@/lib/analytics/posthog-client";
import { usePaywallVariant } from "@/lib/hooks/use-paywall-variant";
import type { AutopilotUpgradeGateProps } from "@/types/autopilot";

const creditsFormat = new Intl.NumberFormat("en-US");

function formatCredits(tier: string) {
  return creditsFormat.format(PLAN_TIER_LIMITS[tier]?.pullRequestCredits ?? 0);
}

/** Stands in for Autopilot when the workspace's plan doesn't include it. */
export function AutopilotUpgradeGate({
  organizationSlug,
  onDialogClosed,
}: AutopilotUpgradeGateProps) {
  const tCommon = useTranslations("common");
  const paywall = usePaywallVariant();
  const [dialogOpen, setDialogOpen] = useState(false);
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current || paywall.loading) {
      return;
    }
    tracked.current = true;
    trackEvent(POSTHOG_EVENTS.PAYWALL_SHOWN, {
      kind: PAYWALL_KINDS.AUTOPILOT_LOCKED,
      route: AUTOPILOT_NAV_LINK,
      plan_shown: FEATURED_PLAN_TIER,
      paywall_variant: paywall.variant,
    });
  }, [paywall.loading, paywall.variant]);

  const upgradeLabel = tCommon("actions.upgrade");
  const openPlans = () => setDialogOpen(true);

  return (
    <div className="space-y-6">
      <PageHeading title="Autopilot" />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-8">
        <div className="flex flex-col items-center pt-4 text-center">
          <PlanBadge tier="growth">{AUTOPILOT_UPGRADE_COPY.eyebrow}</PlanBadge>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-balance">
            {AUTOPILOT_UPGRADE_COPY.title}
          </h2>
          <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-relaxed text-pretty">
            {AUTOPILOT_UPGRADE_COPY.description}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button onClick={openPlans} type="button">
              {upgradeLabel}
            </Button>
            <a
              aria-label="Learn more about Autopilot"
              className={buttonVariants({ variant: "outline" })}
              href={AUTOPILOT_LEARN_MORE_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              Learn more
            </a>
          </div>
        </div>

        <AutopilotUpgradeSection
          action={
            <StatusBadge
              appearance={{ variant: "secondary" }}
              label={AUTOPILOT_UPGRADE_COPY.examplesBadge}
            />
          }
          footer={
            <p className="text-muted-foreground text-xs">
              {AUTOPILOT_UPGRADE_COPY.examplesFooter}
            </p>
          }
          heading={AUTOPILOT_UPGRADE_COPY.examplesHeading}
        >
          <ul className="divide-border divide-y">
            {AUTOPILOT_UPGRADE_EXAMPLES.map((example) => (
              <li
                className="flex items-center gap-3 py-2.5 first:pt-0.5 last:pb-0.5"
                key={example.kind}
              >
                <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <HugeiconsIcon
                    aria-hidden="true"
                    className="size-4"
                    icon={AUTOPILOT_KIND_META[example.kind].icon}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-pretty">
                    {example.title}
                  </p>
                  <p className="text-muted-foreground text-xs text-pretty">
                    {AUTOPILOT_KIND_META[example.kind].label} · {example.detail}
                  </p>
                </div>
                <StatusBadge
                  appearance={CONTENT_PULL_REQUEST_BADGES.draft}
                  label="Draft"
                />
              </li>
            ))}
          </ul>
        </AutopilotUpgradeSection>

        <AutopilotUpgradeSection
          footer={
            <>
              <p className="text-muted-foreground text-xs">
                {AUTOPILOT_UPGRADE_COPY.creditsLabel}:{" "}
                <span className="text-foreground tabular-nums">
                  Growth {formatCredits(PLANS.GROWTH)} · Scale{" "}
                  {formatCredits(PLANS.SCALE)}
                </span>
              </p>
              <Button onClick={openPlans} size="sm" type="button">
                {upgradeLabel}
              </Button>
            </>
          }
          heading={AUTOPILOT_UPGRADE_COPY.automationsHeading}
        >
          <div className="grid gap-x-6 gap-y-4 py-1 sm:grid-cols-2">
            {AUTOPILOT_AUTOMATION_KINDS.map((kind) => (
              <div className="flex gap-3" key={kind}>
                <HugeiconsIcon
                  aria-hidden="true"
                  className="text-muted-foreground mt-0.5 size-4 shrink-0"
                  icon={AUTOPILOT_KIND_META[kind].icon}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {AUTOPILOT_AUTOMATIONS[kind].name}
                  </p>
                  <p className="text-muted-foreground text-xs text-pretty">
                    {AUTOPILOT_AUTOMATIONS[kind].description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </AutopilotUpgradeSection>
      </div>
      <GeoUpgradeDialog
        entry="autopilot"
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            onDialogClosed();
          }
        }}
        open={dialogOpen}
        slug={organizationSlug}
      />
    </div>
  );
}
