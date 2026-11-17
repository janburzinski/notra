"use client";

import { preferredGeoLanguage } from "@notra/geo-core/utils/geo-locale-language";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { GeoProjectCreateDialog } from "@/components/geo/project-create-dialog";
import { useGeoProjectSetUp } from "@/lib/hooks/use-geo";
import { useGeoActiveProject } from "@/lib/hooks/use-geo-active-project";
import { useGeoProjectQueryState } from "@/lib/hooks/use-geo-project-query";
import type { GeoSetupButtonProps } from "@/types/geo";

export function GeoSetupButton({
  organizationId,
  children,
  className,
  size,
}: GeoSetupButtonProps) {
  const tGeoShared = useTranslations("geo.shared");
  const [open, setOpen] = useState(false);
  const [, setProjectParam] = useGeoProjectQueryState();
  const { project } = useGeoActiveProject(organizationId);
  const setUp = useGeoProjectSetUp(organizationId);
  // A project added from analytics has no GEO tracking yet: set it up in
  // place rather than adding a second project for the same website.
  const setUpProjectId = project?.id;

  return (
    <>
      <Button
        className={className}
        loading={setUp.isPending}
        onClick={() => {
          if (!setUpProjectId) {
            setOpen(true);
            return;
          }
          setUp.mutate({
            projectId: setUpProjectId,
            languages: [
              preferredGeoLanguage(
                typeof navigator === "undefined" ? null : navigator.languages
              ),
            ],
          });
        }}
        size={size}
        type="button"
      >
        {children ?? tGeoShared("setUpGeoTracking")}
      </Button>
      <GeoProjectCreateDialog
        onCreated={(projectId) => setProjectParam(projectId)}
        onOpenChange={setOpen}
        open={open}
        organizationId={organizationId}
      />
    </>
  );
}
