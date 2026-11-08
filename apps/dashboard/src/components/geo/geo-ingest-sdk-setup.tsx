"use client";

import {
  GEO_INGEST_FRAMEWORK_OPTIONS,
  GEO_INGEST_PACKAGE_MANAGER_OPTIONS,
  GEO_INGEST_TOKEN_ENV,
} from "@notra/geo-core/constants/geo";
import { useTranslations } from "use-intl";

import { CodeSnippet, CodeSnippetTabs } from "@/components/geo/code-snippet";
import { GeoSetupCopyField } from "@/components/geo/geo-setup-copy-field";
import { GeoSetupStep } from "@/components/geo/geo-setup-step";
import { GeoPackageManagerIcon } from "@/components/geo/package-manager-icon";
import { TRAFFIC_INSTALL_COPY_KINDS } from "@/constants/geo-analytics";
import { GEO_SETUP_MASKED_TOKEN } from "@/constants/geo-ingest-setup";
import type { GeoIngestSdkSetupProps } from "@/types/geo";
import {
  geoIngestInstallCommand,
  geoIngestSnippet,
  isGeoIngestFramework,
  isGeoIngestPackageManager,
} from "@/utils/geo-ingest";

const PACKAGE_MANAGER_TABS = GEO_INGEST_PACKAGE_MANAGER_OPTIONS.map(
  (option) => ({
    ...option,
    icon: <GeoPackageManagerIcon manager={option.value} />,
  })
);

/** Install the package, set the token, add the proxy file. */
export function GeoIngestSdkSetup({
  setup,
  framework,
  packageManager,
  onFrameworkChange,
  onPackageManagerChange,
  onCopy,
}: GeoIngestSdkSetupProps) {
  const t = useTranslations("geo.geoIngestSetup");
  const tCommon = useTranslations("common");
  const token = setup?.token ?? "";
  const file =
    GEO_INGEST_FRAMEWORK_OPTIONS.find((option) => option.value === framework)
      ?.file ?? "proxy.ts";

  return (
    <ol>
      <GeoSetupStep
        plain
        action={
          <CodeSnippetTabs
            label={tCommon("labels.packageManager")}
            onValueChange={(value) => {
              if (isGeoIngestPackageManager(value)) {
                onPackageManagerChange(value);
              }
            }}
            options={PACKAGE_MANAGER_TABS}
            value={packageManager}
          />
        }
        index={1}
        title={tCommon("labels.installThePackage")}
      >
        <CodeSnippet
          code={geoIngestInstallCommand(packageManager)}
          onCopy={() => onCopy(TRAFFIC_INSTALL_COPY_KINDS.INSTALL_COMMAND)}
          variant="command"
        />
      </GeoSetupStep>
      <GeoSetupStep
        plain
        description={t("tokenDescription", { env: GEO_INGEST_TOKEN_ENV })}
        index={2}
        title={t("tokenTitle")}
      >
        {token ? (
          <GeoSetupCopyField
            display={`${GEO_INGEST_TOKEN_ENV}=${GEO_SETUP_MASKED_TOKEN}`}
            label={t("tokenTitle")}
            value={`${GEO_INGEST_TOKEN_ENV}=${token}`}
          />
        ) : null}
      </GeoSetupStep>
      <GeoSetupStep plain index={3} title={t("proxyTitle")}>
        <CodeSnippet
          code={geoIngestSnippet(setup, framework)}
          filename={file}
          onCopy={() => onCopy(TRAFFIC_INSTALL_COPY_KINDS.PROXY_SNIPPET)}
          tabs={
            <CodeSnippetTabs
              label={t("framework")}
              onValueChange={(value) => {
                if (isGeoIngestFramework(value)) {
                  onFrameworkChange(value);
                }
              }}
              options={GEO_INGEST_FRAMEWORK_OPTIONS}
              value={framework}
            />
          }
        />
      </GeoSetupStep>
    </ol>
  );
}
