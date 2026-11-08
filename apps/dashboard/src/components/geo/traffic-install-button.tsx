"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@notra/ui/components/shared/responsive-dialog";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { GeoIngestSetup } from "@/components/geo/geo-ingest-setup";
import type { TrafficInstallButtonProps } from "@/types/geo";

/** Inline action where AI crawlers aren't tracked yet: opens the SDK setup. */
export function TrafficInstallButton({ setup }: TrafficInstallButtonProps) {
  const t = useTranslations("geo.trafficInstall");
  return (
    <ResponsiveDialog>
      <ResponsiveDialogTrigger
        render={<Button size="sm" type="button" variant="outline" />}
      >
        {t("trackCrawlers")}
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="max-h-[90dvh] overflow-x-hidden overflow-y-auto sm:max-w-2xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{t("title")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t("description")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <GeoIngestSetup defaultMethod="sdk" setup={setup} variant="dialog" />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
