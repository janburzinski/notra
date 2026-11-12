"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import {
  IconTabsList,
  IconTabsTrigger,
} from "@notra/ui/components/ui/icon-tabs";
import { Tabs, TabsContent } from "@notra/ui/components/ui/tabs";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { DirectionCockpit } from "@/components/geo/directions/direction-cockpit";
import { DirectionInstrument } from "@/components/geo/directions/direction-instrument";
import { DirectionLeaderboard } from "@/components/geo/directions/direction-leaderboard";
import { DirectionReport } from "@/components/geo/directions/direction-report";
import { PageContainer } from "@/components/layout/container";
import { GEO_DIRECTION_TABS } from "@/constants/geo-directions";

export default function PageClient() {
  const t = useTranslations("geo.pages.directions");
  const tGeoShared = useTranslations("geo.shared");
  const tLabels = useTranslations("common.labels");
  const [tab, setTab] = useState("instrument");
  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-4 px-4 lg:px-6">
        <Tabs onValueChange={(value) => setTab(String(value))} value={tab}>
          <PageHeading
            className="@min-[40rem]/main:items-end"
            description={t("description")}
            title={tGeoShared("geoDirections")}
          >
            <IconTabsList value={tab}>
              {GEO_DIRECTION_TABS.map((item) => (
                <IconTabsTrigger
                  icon={<HugeiconsIcon icon={item.icon} size={15} />}
                  key={item.key}
                  value={item.key}
                >
                  {item.key === "leaderboard"
                    ? tLabels("leaderboard")
                    : t(`tabs.${item.key}`)}
                </IconTabsTrigger>
              ))}
            </IconTabsList>
          </PageHeading>

          <TabsContent className="mt-6" value="instrument">
            <DirectionInstrument />
          </TabsContent>
          <TabsContent className="mt-6" value="leaderboard">
            <DirectionLeaderboard />
          </TabsContent>
          <TabsContent className="mt-6" value="cockpit">
            <DirectionCockpit />
          </TabsContent>
          <TabsContent className="mt-6" value="report">
            <DirectionReport />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
