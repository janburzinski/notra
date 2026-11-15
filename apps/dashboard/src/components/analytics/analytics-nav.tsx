"use client";

import { ChartLineData01Icon, RankingIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  IconTabsList,
  IconTabsTrigger,
} from "@notra/ui/components/ui/icon-tabs";
import { Tabs } from "@notra/ui/components/ui/tabs";
import { useTranslations } from "use-intl";

import Link from "@/components/framework/link";
import { usePathname } from "@/lib/navigation";
import type { AnalyticsNavProps } from "@/types/analytics";

export function AnalyticsNav({ slug }: AnalyticsNavProps) {
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const base = `/${slug}/analytics`;
  const value = pathname.startsWith(`${base}/leaderboard`)
    ? "leaderboard"
    : "overview";

  return (
    <Tabs value={value}>
      {/* Overview and Leaderboard are separate routes, each with its own
          copy of this list; the shared indicator slides between them. */}
      <IconTabsList indicatorId="analytics-social" value={value}>
        <IconTabsTrigger
          icon={<HugeiconsIcon icon={ChartLineData01Icon} size={15} />}
          nativeButton={false}
          render={<Link href={base} />}
          value="overview"
        >
          {tCommon("labels.overview")}
        </IconTabsTrigger>
        <IconTabsTrigger
          icon={<HugeiconsIcon icon={RankingIcon} size={15} />}
          nativeButton={false}
          render={<Link href={`${base}/leaderboard`} />}
          value="leaderboard"
        >
          {tCommon("labels.leaderboard")}
        </IconTabsTrigger>
      </IconTabsList>
    </Tabs>
  );
}
