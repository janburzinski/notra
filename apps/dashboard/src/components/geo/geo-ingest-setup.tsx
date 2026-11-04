"use client";

import { PackageIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  GEO_DRAIN_DOCS_URLS,
  GEO_DRAIN_PROVIDERS,
  GEO_INGEST_DEFAULT_FRAMEWORK,
  GEO_INGEST_DEFAULT_METHOD,
  GEO_INGEST_DEFAULT_PACKAGE_MANAGER,
  GEO_INGEST_FRAMEWORK_OPTIONS,
  GEO_INGEST_METHODS,
  GEO_INGEST_PACKAGE_MANAGER_OPTIONS,
  GEO_INGEST_TOKEN_ENV,
} from "@notra/geo-core/constants/geo";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { AgentPromptButton } from "@notra/ui/components/ui/agent-prompt-button";
import { Cloudflare } from "@notra/ui/components/ui/svgs/cloudflare";
import { Vercel } from "@notra/ui/components/ui/svgs/vercel";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@notra/ui/components/ui/tabs";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { CodeSnippet, CodeSnippetTabs } from "@/components/geo/code-snippet";
import { GeoExternalLinkButton } from "@/components/geo/geo-external-link-button";
import { GeoIngestDrainSetup } from "@/components/geo/geo-ingest-drain-setup";
import { GeoSetupCopyField } from "@/components/geo/geo-setup-copy-field";
import { GeoSetupStep } from "@/components/geo/geo-setup-step";
import { GeoPackageManagerIcon } from "@/components/geo/package-manager-icon";
import { TRAFFIC_INSTALL_COPY_KINDS } from "@/constants/geo-analytics";
import { GEO_SETUP_MASKED_TOKEN } from "@/constants/geo-ingest-setup";
import { trackEvent } from "@/lib/analytics/posthog-client";
import { cn } from "@/lib/utils";
import type { TrafficInstallCopyKind } from "@/types/analytics/geo-events";
import type { GeoIngestSetupPanelProps } from "@/types/geo";
import { toastCopyError } from "@/utils/copy-to-clipboard";
import {
  geoCloudflareAgentPrompt,
  geoIngestAgentPrompt,
  geoIngestInstallCommand,
  geoIngestSnippet,
  isGeoIngestFramework,
  isGeoIngestMethod,
  isGeoIngestPackageManager,
} from "@/utils/geo-ingest";

const PACKAGE_MANAGER_TABS = GEO_INGEST_PACKAGE_MANAGER_OPTIONS.map(
  (option) => ({
    ...option,
    icon: <GeoPackageManagerIcon manager={option.value} />,
  })
);

const METHOD_ICONS = {
  sdk: <HugeiconsIcon aria-hidden="true" icon={PackageIcon} />,
  vercel: <Vercel aria-hidden="true" className="size-3.5" />,
  cloudflare: <Cloudflare aria-hidden="true" />,
};

export function GeoIngestSetup({ setup, className }: GeoIngestSetupPanelProps) {
  const t = useTranslations("geo.geoIngestSetup");
  const tCommon = useTranslations("common");
  const [method, setMethod] = useState(GEO_INGEST_DEFAULT_METHOD);
  const [framework, setFramework] = useState(GEO_INGEST_DEFAULT_FRAMEWORK);
  const [packageManager, setPackageManager] = useState(
    GEO_INGEST_DEFAULT_PACKAGE_MANAGER
  );
  const snippet = geoIngestSnippet(setup, framework);
  const installCommand = geoIngestInstallCommand(packageManager);
  const agentPrompt = geoIngestAgentPrompt(setup, framework, packageManager);
  const file =
    GEO_INGEST_FRAMEWORK_OPTIONS.find((option) => option.value === framework)
      ?.file ?? "proxy.ts";
  const token = setup?.token ?? "";
  const cloudflareAgentPrompt = geoCloudflareAgentPrompt(setup);
  const viewedRef = useRef(false);
  const hasToken = token.length > 0;

  useEffect(() => {
    if (viewedRef.current) {
      return;
    }
    viewedRef.current = true;
    trackEvent(POSTHOG_EVENTS.TRAFFIC_INSTALL_SNIPPET_VIEWED, {
      framework,
      package_manager: packageManager,
      has_token: hasToken,
    });
  }, [framework, hasToken, packageManager]);

  const trackCopied = (kind: TrafficInstallCopyKind) => {
    trackEvent(POSTHOG_EVENTS.TRAFFIC_INSTALL_SNIPPET_COPIED, {
      framework,
      package_manager: packageManager,
      method,
      kind,
    });
  };

  return (
    <div
      className={cn(
        "border-shell-border bg-shell overflow-hidden rounded-2xl border",
        className
      )}
    >
      <Tabs
        onValueChange={(value) => {
          if (isGeoIngestMethod(value)) {
            setMethod(value);
          }
        }}
        value={method}
      >
        <div className="border-table-card-border bg-table-card shadow-table-card m-0.5 rounded-[14px] border p-5">
          <TabsList aria-label={t("method")} className="mb-5 w-full">
            {GEO_INGEST_METHODS.map((option) => (
              <TabsTrigger key={option} value={option}>
                {METHOD_ICONS[option]}
                {t(`methods.${option}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          {GEO_DRAIN_PROVIDERS.map((provider) => (
            <TabsContent key={provider} value={provider}>
              <GeoIngestDrainSetup
                onCopy={() =>
                  trackCopied(TRAFFIC_INSTALL_COPY_KINDS.DRAIN_SETUP)
                }
                provider={provider}
                setup={setup}
              />
            </TabsContent>
          ))}
          <TabsContent value="sdk">
            <ol>
              <GeoSetupStep
                action={
                  <CodeSnippetTabs
                    label={tCommon("labels.packageManager")}
                    onValueChange={(value) => {
                      if (isGeoIngestPackageManager(value)) {
                        setPackageManager(value);
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
                  code={installCommand}
                  onCopy={() =>
                    trackCopied(TRAFFIC_INSTALL_COPY_KINDS.INSTALL_COMMAND)
                  }
                  variant="command"
                />
              </GeoSetupStep>
              <GeoSetupStep
                description={t("tokenDescription", {
                  env: GEO_INGEST_TOKEN_ENV,
                })}
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
              <GeoSetupStep index={3} title={t("proxyTitle")}>
                <CodeSnippet
                  code={snippet}
                  filename={file}
                  onCopy={() =>
                    trackCopied(TRAFFIC_INSTALL_COPY_KINDS.PROXY_SNIPPET)
                  }
                  tabs={
                    <CodeSnippetTabs
                      label={t("framework")}
                      onValueChange={(value) => {
                        if (isGeoIngestFramework(value)) {
                          setFramework(value);
                        }
                      }}
                      options={GEO_INGEST_FRAMEWORK_OPTIONS}
                      value={framework}
                    />
                  }
                />
              </GeoSetupStep>
            </ol>
          </TabsContent>
        </div>
        <div className="flex flex-col items-center gap-2.5 px-3.5 py-3 text-center">
          <div className="min-w-0 text-xs">
            <p className="text-foreground font-medium">
              {t(`footer.${method}.title`)}
            </p>
            <p className="text-muted-foreground text-pretty">
              {t(`footer.${method}.description`)}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {method === "vercel" ? null : (
              <AgentPromptButton
                copiedLabel={tCommon("labels.promptCopied")}
                label={tCommon("labels.copyAgentPrompt")}
                onCopy={() =>
                  trackCopied(TRAFFIC_INSTALL_COPY_KINDS.AGENT_PROMPT)
                }
                onCopyError={toastCopyError}
                prompt={
                  method === "cloudflare" ? cloudflareAgentPrompt : agentPrompt
                }
              />
            )}
            {method === "sdk" ? null : (
              <GeoExternalLinkButton
                href={GEO_DRAIN_DOCS_URLS[method]}
                label={t("drains.docsLink")}
                variant={method === "cloudflare" ? "ghost" : "outline"}
              />
            )}
          </div>
        </div>
      </Tabs>
    </div>
  );
}
