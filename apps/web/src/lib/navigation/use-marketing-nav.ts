import { useMemo } from "react";
import { useTranslations } from "use-intl";

import {
  REPORT_CATEGORY_IDS,
  REPORTS_NAV_CATEGORIES,
} from "@/constants/reports-navigation";
import type {
  MarketingNavEntry,
  MarketingNavItemConfig,
  MarketingNavRailItem,
} from "@/types/navbar";
import { MARKETING_NAV } from "@/utils/navigation";

export function useMarketingNav(): readonly MarketingNavEntry[] {
  const t = useTranslations("navbar");

  return useMemo(() => {
    const item = ({ id, ...rest }: MarketingNavItemConfig) => ({
      ...rest,
      label: t(`items.${id}.label`),
      description: t(`items.${id}.description`),
    });
    const reportRail = REPORTS_NAV_CATEGORIES.map(
      ({ slug, subject, href, icon }): MarketingNavRailItem => {
        const id = REPORT_CATEGORY_IDS.find((category) => category === slug);
        return {
          href,
          icon,
          label: id ? t(`reports.categories.${id}.label`) : subject,
          description: id
            ? t(`reports.categories.${id}.description`)
            : t("reports.fallbackDescription"),
        };
      }
    );

    return MARKETING_NAV.map((entry) => {
      const label = t(`groups.${entry.id}`);
      if (entry.type === "link") {
        return { ...entry, label };
      }
      return {
        ...entry,
        label,
        cards: entry.cards.map(item),
        rail: entry.panel === "reports" ? reportRail : entry.rail.map(item),
      };
    });
  }, [t]);
}
