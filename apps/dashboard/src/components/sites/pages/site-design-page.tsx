"use client";

import { useTranslations } from "use-intl";

import { SiteDesignAppearance } from "@/components/sites/site-design-appearance";
import { SiteDesignError } from "@/components/sites/site-design-error";
import { SiteDesignIntegrations } from "@/components/sites/site-design-integrations";
import { SiteDesignNavigation } from "@/components/sites/site-design-navigation";
import { SiteSettingsList } from "@/components/sites/site-settings-item";
import { useSiteWorkspace } from "@/components/sites/site-workspace-context";
import { useSiteDesignSection } from "@/lib/hooks/use-site-design-section";

export function SiteDesignPage() {
  const t = useTranslations("sites.design.sections");
  const saving = useTranslations("sites.design.workspace");
  const state = useSiteWorkspace();
  const { active } = useSiteDesignSection();
  if (!state) {
    return (
      <p aria-busy="true" className="text-muted-foreground text-sm">
        {saving("loading")}
      </p>
    );
  }
  if (state.malformed) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {saving("malformed")}
      </p>
    );
  }
  return (
    <div
      className="grid items-start gap-6 md:grid-cols-[9rem_minmax(0,1fr)] md:gap-10 lg:gap-12"
      data-site-design
    >
      <SiteDesignNavigation />
      <section className="max-w-3xl min-w-0 space-y-5">
        <header className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">
            {t(`titles.${active.id}`)}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t(`hints.${active.id}`)}
          </p>
        </header>
        <div inert={state.readOnly} aria-busy={state.readOnly}>
          {active.id === "integrations" ? (
            <SiteDesignIntegrations key={state.scope.branch ?? "production"} />
          ) : (
            <SiteSettingsList>
              <SiteDesignAppearance
                key={`${active.id}:${state.scope.branch ?? "production"}:${state.document.publishedBlobSha}`}
                section={active.id}
              />
            </SiteSettingsList>
          )}
          {active.id === "typography" ? <SiteDesignError path="fonts" /> : null}
        </div>
      </section>
    </div>
  );
}
