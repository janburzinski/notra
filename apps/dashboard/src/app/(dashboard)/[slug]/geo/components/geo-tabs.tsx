"use client";

import { Route01Icon, SmileIcon, ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { GEO_EMPTY_COMPETITOR_SHARE_TIMESERIES } from "@notra/geo-core/constants/geo";
import type { GeoTab } from "@notra/geo-core/types/geo";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import {
  IconTabsList,
  IconTabsTrigger,
} from "@notra/ui/components/ui/icon-tabs";
import { Tabs } from "@notra/ui/components/ui/tabs";
import { Activity, type ReactNode, startTransition, useState } from "react";
import { InstrumentGrid } from "ui/card/grid";
import { useTranslations } from "use-intl";

import { BrandSentimentCard } from "@/components/geo/brand-sentiment-card";
import { EngineRateTable } from "@/components/geo/engine-rate-table";
import { JourneysTab } from "@/components/geo/journeys-tab";
import { LanguagePerformanceCard } from "@/components/geo/language-performance-card";
import { MentionRateCard } from "@/components/geo/mention-rate-card";
import { MentionTrendCard } from "@/components/geo/mention-trend-card";
import { ShareOfVoiceCard } from "@/components/geo/share-of-voice-card";
import { WhatChangedCard } from "@/components/geo/what-changed-card";
import { trackEvent } from "@/lib/analytics/posthog-client";
import { cn } from "@/lib/utils";
import type { GeoTabPanelProps, GeoTabsProps } from "@/types/geo";
import { toGeoTab } from "@/utils/geo-tabs";

function TabSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full min-w-0 flex-col", className)}>
      {children}
    </div>
  );
}

/**
 * A tab stays mounted once opened, hidden by Activity, like the Traffic tabs:
 * switching back shows it as it was instead of remounting into a skeleton.
 * After the first switch, revealing a tab replays the fade, since leaving
 * `display: none` restarts its animation.
 */
function GeoTabPanel({
  tab,
  activeTab,
  opened,
  fade,
  children,
}: GeoTabPanelProps) {
  if (!opened.includes(tab)) {
    return null;
  }
  return (
    <Activity mode={tab === activeTab ? "visible" : "hidden"}>
      <div
        className={cn(
          fade &&
            "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-fast motion-safe:ease-out"
        )}
        data-geo-tab-panel={tab}
      >
        {children}
      </div>
    </Activity>
  );
}

export function GeoTabs({
  activeTab,
  onActiveTabChange,
  organizationSlug,
  settings,
  engines,
  timeseriesPoints,
  competitorPoints,
  competitorShareTimeseries = GEO_EMPTY_COMPETITOR_SHARE_TIMESERIES,
  competitors,
  languagePoints,
  promptResults,
  isScanning,
  journeys,
  journeysFailed,
  journeyStats,
  journeyStatsFailed,
  journeysLoading,
  journeyRange,
  organizationId,
}: GeoTabsProps) {
  const t = useTranslations("geo.pages.tabs");
  const tCommon = useTranslations("common");
  // A tab change re-renders the whole page, so it runs as a transition and
  // the tab list keeps its own state: the indicator slides at once instead
  // of freezing until the next tab has rendered.
  const [pendingTab, setPendingTab] = useState<GeoTab | null>(null);
  if (pendingTab !== null && pendingTab === activeTab) {
    setPendingTab(null);
  }
  const listTab = pendingTab ?? activeTab;
  const [opened, setOpened] = useState<readonly GeoTab[]>(() =>
    activeTab === "visibility" ? [activeTab] : ["visibility", activeTab]
  );
  if (!opened.includes(activeTab)) {
    setOpened([...opened, activeTab]);
  }
  // Set in the same transition as the tab, so the panel being left never
  // picks up the fade, and the first page load does not fade at all.
  const [fade, setFade] = useState(false);
  const panel = { activeTab, opened, fade };

  return (
    <div className="flex min-w-0 flex-col">
      <Tabs
        onValueChange={(value) => {
          const tab = toGeoTab(value);
          trackEvent(POSTHOG_EVENTS.GEO_TAB_CHANGED, { tab });
          setPendingTab(tab);
          startTransition(() => {
            setFade(true);
            onActiveTabChange(tab);
          });
        }}
        value={listTab}
      >
        <IconTabsList aria-label={t("label")} value={listTab}>
          <IconTabsTrigger
            icon={<HugeiconsIcon icon={ViewIcon} size={15} />}
            value="visibility"
          >
            {tCommon("labels.visibility")}
          </IconTabsTrigger>
          <IconTabsTrigger
            icon={<HugeiconsIcon icon={SmileIcon} size={15} />}
            value="brand-sentiment"
          >
            {tCommon("labels.brandSentiment")}
          </IconTabsTrigger>
          <IconTabsTrigger
            icon={<HugeiconsIcon icon={Route01Icon} size={15} />}
            value="journeys"
          >
            {tCommon("labels.journeys")}
          </IconTabsTrigger>
        </IconTabsList>
      </Tabs>

      <GeoTabPanel tab="visibility" {...panel}>
        <div className="mt-6 flex flex-col gap-6 overflow-visible">
          <InstrumentGrid className="grid-cols-1 items-stretch gap-4 overflow-visible @min-[44rem]/main:grid-cols-12">
            <TabSection className="relative z-20 overflow-visible @min-[44rem]/main:col-span-5">
              <MentionRateCard
                competitors={competitors}
                engines={engines}
                isScanning={isScanning}
                organizationSlug={organizationSlug}
                promptResults={promptResults}
                settings={settings}
                timeseriesPoints={timeseriesPoints}
                trackedEngines={settings.engines}
              />
            </TabSection>
            <TabSection className="@min-[44rem]/main:col-span-7">
              <MentionTrendCard
                isScanning={isScanning}
                points={timeseriesPoints}
              />
            </TabSection>
          </InstrumentGrid>
          <TabSection>
            <WhatChangedCard
              competitors={competitors}
              isScanning={isScanning}
              organizationId={organizationId}
              organizationSlug={organizationSlug}
              promptResults={promptResults}
            />
          </TabSection>
          <TabSection>
            <EngineRateTable
              aliases={settings.aliases}
              companyName={settings.companyName}
              competitors={competitors}
              engines={engines}
              isScanning={isScanning}
              organizationSlug={organizationSlug}
              promptResults={promptResults}
              timeseriesPoints={timeseriesPoints}
              trackedEngines={settings.engines}
            />
          </TabSection>
          <InstrumentGrid className="grid-cols-1 gap-4 @min-[44rem]/main:grid-cols-2">
            <TabSection>
              <ShareOfVoiceCard
                aliases={settings.aliases}
                companyName={settings.companyName}
                competitors={competitors}
                isScanning={isScanning}
                organizationId={organizationId}
                organizationSlug={organizationSlug}
                points={competitorPoints}
                timeseries={competitorShareTimeseries}
              />
            </TabSection>
            <TabSection>
              <LanguagePerformanceCard
                isScanning={isScanning}
                organizationId={organizationId}
                points={languagePoints}
                settings={settings}
              />
            </TabSection>
          </InstrumentGrid>
        </div>
      </GeoTabPanel>

      <GeoTabPanel tab="brand-sentiment" {...panel}>
        <div className="mt-6">
          <TabSection>
            <BrandSentimentCard
              organizationId={organizationId}
              isScanning={isScanning}
            />
          </TabSection>
        </div>
      </GeoTabPanel>

      <GeoTabPanel tab="journeys" {...panel}>
        <JourneysTab
          journeysFailed={journeysFailed}
          journeyStats={journeyStats}
          journeyStatsFailed={journeyStatsFailed}
          journeys={journeys}
          loading={journeysLoading}
          organizationId={organizationId}
          organizationSlug={organizationSlug}
          range={journeyRange}
        />
      </GeoTabPanel>
    </div>
  );
}
