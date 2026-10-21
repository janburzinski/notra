import { useSite } from "@/components/sites/site-context";
import { useBrandGuidelines } from "@/lib/hooks/use-brand-guidelines";
import { useGeoProjectsDb } from "@/lib/hooks/use-geo-db";
import type { SiteBrandDefaults } from "@/types/site-design";
import { brandDefaultsFromGuidelines } from "@/utils/site-design";

/** Colors, logos and fonts from the brand identity of the site's project. */
export function useSiteBrandDefaults(): SiteBrandDefaults | null {
  const { organizationId, detail } = useSite();
  const { projects } = useGeoProjectsDb(organizationId);
  const brandSettingsId =
    projects.find((project) => project.id === detail.site.projectId)
      ?.brandSettingsId ?? "";
  const { data } = useBrandGuidelines(organizationId, brandSettingsId);
  return data ? brandDefaultsFromGuidelines(data) : null;
}
