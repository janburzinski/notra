"use client";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "use-intl";

import { useSiteWorkspace } from "@/components/sites/site-workspace-context";
import { SITE_DESIGN_SECTIONS } from "@/constants/site-design-sections";
import { useSiteDesignSection } from "@/lib/hooks/use-site-design-section";
import { cn } from "@/lib/utils";
import { configSectionChanged } from "@/utils/site-design-sections";

export function SiteDesignNavigation() {
  const t = useTranslations("sites.design.sections");
  const saving = useTranslations("sites.design.workspace");
  const state = useSiteWorkspace()!;
  const { active, select } = useSiteDesignSection();
  return (
    <nav
      aria-label={t("navigation")}
      className="-mx-1 flex gap-0.5 overflow-x-auto px-1 md:sticky md:top-18 md:-mx-2.5 md:-mt-1 md:flex-col md:overflow-visible md:px-0"
    >
      {SITE_DESIGN_SECTIONS.map((section) => {
        const current = active.id === section.id;
        return (
          <button
            aria-current={current ? "page" : undefined}
            className={cn(
              "group focus-visible:ring-ring/50 flex h-8 shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors outline-none focus-visible:ring-3 md:w-full",
              current
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
            key={section.id}
            type="button"
            onClick={() => select(section.id)}
          >
            <HugeiconsIcon
              aria-hidden="true"
              className={cn(
                "size-4 shrink-0 transition-colors",
                current
                  ? "text-foreground"
                  : "text-muted-foreground group-hover:text-foreground"
              )}
              icon={section.icon}
              strokeWidth={1.75}
            />
            <span className="flex-1 truncate text-start">
              {t(`titles.${section.id}`)}
            </span>
            {configSectionChanged(
              state.config,
              state.published,
              section.paths
            ) ? (
              <span
                aria-label={saving("unpublished")}
                className="bg-primary size-1.5 shrink-0 rounded-full"
                role="img"
              />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
