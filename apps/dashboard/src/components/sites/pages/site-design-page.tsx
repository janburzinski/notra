"use client";

import { useTranslations } from "use-intl";

import { SiteDesignAppearance } from "@/components/sites/site-design-appearance";
import { SiteDesignError } from "@/components/sites/site-design-error";
import { SiteDesignIntegrations } from "@/components/sites/site-design-integrations";
import { SiteDesignSkeleton } from "@/components/sites/site-page-skeleton";
import {
  useSiteWorkspace,
  useSiteWorkspaceLoad,
} from "@/components/sites/site-workspace-context";
import {
  SiteConfigMalformed,
  SiteWorkspaceLoadError,
} from "@/components/sites/site-workspace-error";
import { useSiteDesignSection } from "@/lib/hooks/use-site-design-section";

export function SiteDesignPage() {
  const t = useTranslations("sites.design.sections");
  const state = useSiteWorkspace();
  const load = useSiteWorkspaceLoad();
  const { active } = useSiteDesignSection();
  if (!state) {
    return load.failed ? <SiteWorkspaceLoadError /> : <SiteDesignSkeleton />;
  }
  if (state.malformed) {
    return <SiteConfigMalformed />;
  }
  return (
    <section
      className="mx-auto w-full max-w-3xl min-w-0 space-y-5"
      data-site-design
    >
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
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
          <SiteDesignAppearance
            key={`${active.id}:${state.scope.branch ?? "production"}:${state.document.publishedBlobSha}`}
            section={active.id}
          />
        )}
        {active.id === "typography" ? <SiteDesignError path="fonts" /> : null}
      </div>
    </section>
  );
}
