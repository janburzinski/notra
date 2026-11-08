"use client";

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { AnalyticsImportDialog } from "@/components/analytics-import/analytics-import-dialog";
import { ImportActivityPill } from "@/components/analytics-import/import-activity-pill";
import { Button } from "@/components/button";
import { TrafficEmbedDialog } from "@/components/geo/traffic-embed-dialog";
import { useAnalyticsImports } from "@/lib/hooks/use-analytics-imports";
import { useGeoActiveProject } from "@/lib/hooks/use-geo-active-project";
import { useSettingsModal } from "@/lib/hooks/use-settings-modal";
import { useWebAnalyticsFlag } from "@/lib/hooks/use-web-analytics-flag";
import type { TrafficActionsMenuProps } from "@/types/geo";
import { downloadTrafficCsv } from "@/utils/traffic-export";

/** Export, embed, tracking setup and history imports behind one trigger. */
export function TrafficActionsMenu({
  organizationId,
  traffic,
  web,
  range,
  path,
}: TrafficActionsMenuProps) {
  const t = useTranslations("geo.trafficExport");
  const [embedOpen, setEmbedOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const { openSettings } = useSettingsModal();
  const webFlag = useWebAnalyticsFlag();
  const { project, domain } = useGeoActiveProject(organizationId);
  const projectId = project?.id ?? null;
  const { data: importData } = useAnalyticsImports(
    organizationId,
    projectId,
    webFlag.enabled && projectId !== null
  );

  return (
    <>
      {webFlag.enabled ? (
        <ImportActivityPill
          imports={importData?.imports ?? []}
          onOpen={() => setImportOpen(true)}
        />
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t("more")}
          render={<Button size="icon" variant="secondary" />}
        >
          <HugeiconsIcon
            className="text-muted-foreground size-4"
            icon={MoreHorizontalIcon}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            disabled={!(traffic && web)}
            onClick={() => {
              if (traffic && web) {
                downloadTrafficCsv(traffic, web, range, path);
              }
            }}
          >
            {t("csv")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEmbedOpen(true)}>
            {t("embed")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openSettings("geo-tracking")}>
            {t("trackingSetup")}
          </DropdownMenuItem>
          {webFlag.enabled ? (
            <DropdownMenuItem onClick={() => setImportOpen(true)}>
              {t("importHistory")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <TrafficEmbedDialog
        onOpenChange={setEmbedOpen}
        open={embedOpen}
        organizationId={organizationId}
      />
      {webFlag.enabled ? (
        <AnalyticsImportDialog
          defaultHost={domain ?? ""}
          onOpenChange={setImportOpen}
          open={importOpen}
          organizationId={organizationId}
          projectId={projectId}
        />
      ) : null}
    </>
  );
}
