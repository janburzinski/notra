"use client";

import {
  GEO_INGEST_DEFAULT_PACKAGE_MANAGER,
  GEO_INGEST_PACKAGE_MANAGER_OPTIONS,
  GEO_INGEST_TOKEN_ENV,
} from "@notra/geo-core/constants/geo";
import { AgentPromptButton } from "@notra/ui/components/ui/agent-prompt-button";
import { Button } from "@notra/ui/components/ui/button";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { CodeSnippet, CodeSnippetTabs } from "@/components/geo/code-snippet";
import { GeoSetupCopyField } from "@/components/geo/geo-setup-copy-field";
import { GeoSetupStep } from "@/components/geo/geo-setup-step";
import { GeoPackageManagerIcon } from "@/components/geo/package-manager-icon";
import { GEO_SETUP_MASKED_TOKEN } from "@/constants/geo-ingest-setup";
import {
  MCP_SETUP_DEFAULT_TRANSPORT,
  MCP_SETUP_FILE,
  MCP_SETUP_SNIPPETS,
  MCP_SETUP_TRANSPORT_LABELS,
  MCP_SETUP_TRANSPORTS,
} from "@/constants/mcp-analytics";
import type { McpSetupProps } from "@/types/mcp-analytics";
import { toastCopyError } from "@/utils/copy-to-clipboard";
import {
  geoIngestInstallCommand,
  isGeoIngestPackageManager,
} from "@/utils/geo-ingest";
import {
  isMcpSetupTransport,
  mcpSetupAgentPrompt,
} from "@/utils/mcp-analytics";

const PACKAGE_MANAGER_TABS = GEO_INGEST_PACKAGE_MANAGER_OPTIONS.map(
  (option) => ({
    ...option,
    icon: <GeoPackageManagerIcon manager={option.value} />,
  })
);

const TRANSPORT_TABS = MCP_SETUP_TRANSPORTS.map((transport) => ({
  value: transport,
  label: MCP_SETUP_TRANSPORT_LABELS[transport],
}));

/** The website install card, with the transport wrap as the last step. */
export function McpSetup({ setup, setupFailed, onRetrySetup }: McpSetupProps) {
  const t = useTranslations("geo.pages.mcp.setup");
  const tCommon = useTranslations("common");
  const tActions = useTranslations("common.actions");
  const [transport, setTransport] = useState(MCP_SETUP_DEFAULT_TRANSPORT);
  const [packageManager, setPackageManager] = useState(
    GEO_INGEST_DEFAULT_PACKAGE_MANAGER
  );
  const installCommand = geoIngestInstallCommand(packageManager);
  const token = setup?.token ?? "";

  return (
    <div className="border-shell-border bg-shell overflow-hidden rounded-2xl border">
      <div className="border-table-card-border bg-table-card shadow-table-card m-0.5 rounded-[14px] border p-5">
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
                variant="default"
              />
            }
            index={1}
            title={tCommon("labels.installThePackage")}
          >
            <CodeSnippet code={installCommand} variant="command" />
          </GeoSetupStep>
          <GeoSetupStep
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
            {!token && setupFailed ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="text-destructive text-xs">{t("tokenFailed")}</p>
                <Button
                  onClick={() => onRetrySetup?.()}
                  size="sm"
                  variant="outline"
                >
                  {tActions("tryAgain")}
                </Button>
              </div>
            ) : null}
          </GeoSetupStep>
          <GeoSetupStep
            description={t(`transportDescription.${transport}`)}
            index={3}
            title={t("transportTitle")}
          >
            <CodeSnippet
              code={MCP_SETUP_SNIPPETS[transport]}
              filename={MCP_SETUP_FILE}
              tabs={
                <CodeSnippetTabs
                  label={t("transport")}
                  onValueChange={(value) => {
                    if (isMcpSetupTransport(value)) {
                      setTransport(value);
                    }
                  }}
                  options={TRANSPORT_TABS}
                  value={transport}
                />
              }
            />
          </GeoSetupStep>
        </ol>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-3.5 py-3">
        <div className="min-w-0 text-xs">
          <p className="text-foreground font-medium">{t("footerTitle")}</p>
          <p className="text-muted-foreground text-pretty">
            {t("footerDescription")}
          </p>
        </div>
        <AgentPromptButton
          copiedLabel={tCommon("labels.promptCopied")}
          label={tCommon("labels.copyAgentPrompt")}
          onCopyError={toastCopyError}
          prompt={mcpSetupAgentPrompt(transport, installCommand)}
        />
      </div>
    </div>
  );
}
