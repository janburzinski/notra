"use client";

import { Skeleton } from "@notra/ui/components/ui/skeleton";

import { ImportHistoryCard } from "@/components/analytics-import/import-history-card";
import { GeoIngestSetup } from "@/components/geo/geo-ingest-setup";
import { GeoSettingsForm } from "@/components/geo/geo-settings-form";
import { GeoProjectDeleteSection } from "@/components/geo/project-delete-section";
import { GeoProjectQueryProvider } from "@/components/providers/geo-project-provider";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { SettingsPane } from "@/components/settings/settings-pane";
import {
  useGeoIngestSetup,
  useGeoModelCatalog,
  useGeoSettings,
} from "@/lib/hooks/use-geo";
import { useGeoProjectsDb } from "@/lib/hooks/use-geo-db";
import { useGeoProjectQueryState } from "@/lib/hooks/use-geo-project-query";
import type {
  GeoSettingsFormSection,
  GeoSettingsPaneSection,
} from "@/types/geo";

export function GeoSettingsPane({
  section,
}: {
  section: GeoSettingsPaneSection;
}) {
  const [projectParam] = useGeoProjectQueryState();

  return (
    <GeoProjectQueryProvider>
      {section === "tracking" ? (
        <GeoTrackingSettingsContent key={projectParam ?? "default"} />
      ) : (
        <GeoSettingsPaneContent
          key={projectParam ?? "default"}
          section={section}
        />
      )}
    </GeoProjectQueryProvider>
  );
}

function GeoSettingsPaneContent({
  section,
}: {
  section: GeoSettingsFormSection;
}) {
  const [projectParam, setProjectParam] = useGeoProjectQueryState();
  const { activeOrganization } = useOrganizationsContext();
  const organizationId = activeOrganization?.id ?? "";

  const { data: settingsData, isPending } = useGeoSettings(organizationId);
  const { data: catalog } = useGeoModelCatalog(organizationId);
  const { projects } = useGeoProjectsDb(organizationId);
  const activeProjectId =
    settingsData?.settings?.projectId ?? projectParam ?? projects.at(0)?.id;
  const activeProject = projects.find(
    (project) => project.id === activeProjectId
  );
  const replacementProjectId = projects.find(
    (project) => project.id !== activeProjectId
  )?.id;

  if (isPending || !catalog) {
    return (
      <SettingsPane>
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
        {section === "brand" ? <Skeleton className="h-48 rounded-lg" /> : null}
      </SettingsPane>
    );
  }

  return (
    <SettingsPane>
      <GeoSettingsForm
        catalog={catalog}
        hideHeader
        key={activeProjectId}
        organizationId={organizationId}
        section={section}
        settings={settingsData?.settings ?? null}
      />
      {section === "brand" && activeProject ? (
        <GeoProjectDeleteSection
          onDeleted={setProjectParam}
          organizationId={organizationId}
          project={activeProject}
          replacementProjectId={replacementProjectId}
        />
      ) : null}
    </SettingsPane>
  );
}

/** Install tracking and import history for the active project. */
function GeoTrackingSettingsContent() {
  const { activeOrganization } = useOrganizationsContext();
  const organizationId = activeOrganization?.id ?? "";
  const { data: setup, isPending } = useGeoIngestSetup(organizationId);

  if (isPending) {
    return (
      <SettingsPane>
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </SettingsPane>
    );
  }

  return (
    <SettingsPane className="surface-neutral">
      <GeoIngestSetup defaultMethod="script" setup={setup} variant="settings" />
      <ImportHistoryCard variant="settings" />
    </SettingsPane>
  );
}
