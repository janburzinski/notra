"use client";

import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { useTranslations } from "use-intl";

import { SiteDesignAppearance } from "@/components/sites/site-design-appearance";
import { SiteDesignAuthors } from "@/components/sites/site-design-authors";
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
  const branch = state.scope.branch ?? "production";
  let content = (
    <SiteDesignAppearance
      key={`${active.id}:${branch}:${state.document.publishedBlobSha}`}
      section={active.id}
    />
  );
  if (active.id === "integrations") {
    content = <SiteDesignIntegrations key={branch} />;
  } else if (active.id === "authors") {
    content = <SiteDesignAuthors key={branch} />;
  }
  return (
    <section className="w-full min-w-0 space-y-6" data-site-design>
      <PageHeading
        description={t(`hints.${active.id}`)}
        title={t(`titles.${active.id}`)}
      />
      <div inert={state.readOnly} aria-busy={state.readOnly}>
        {content}
        {active.id === "typography" ? <SiteDesignError path="fonts" /> : null}
      </div>
    </section>
  );
}
