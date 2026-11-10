"use client";

import { LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  GEO_INGEST_DEFAULT_FRAMEWORK,
  GEO_INGEST_DEFAULT_METHOD,
  GEO_INGEST_DEFAULT_PACKAGE_MANAGER,
} from "@notra/geo-core/constants/geo";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { ResponsiveDialogFooter } from "@notra/ui/components/shared/responsive-dialog";
import { AgentPromptButton } from "@notra/ui/components/ui/agent-prompt-button";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { GeoIngestDrainSetup } from "@/components/geo/geo-ingest-drain-setup";
import { GeoIngestMethodPicker } from "@/components/geo/geo-ingest-method-picker";
import { GeoIngestScriptSetup } from "@/components/geo/geo-ingest-script-setup";
import { GeoIngestSdkSetup } from "@/components/geo/geo-ingest-sdk-setup";
import { WebKeyRotateButton } from "@/components/geo/web-key-rotate-button";
import { TRAFFIC_INSTALL_COPY_KINDS } from "@/constants/geo-analytics";
import { GEO_INGEST_METHOD_DOCS_URLS } from "@/constants/geo-ingest-script";
import { trackEvent } from "@/lib/analytics/posthog-client";
import { useWebAnalyticsFlag } from "@/lib/hooks/use-web-analytics-flag";
import { cn } from "@/lib/utils";
import type { TrafficInstallCopyKind } from "@/types/analytics/geo-events";
import type {
  GeoIngestDocsLinkProps,
  GeoIngestSetupActionsProps,
  GeoIngestSetupPanelProps,
} from "@/types/geo";
import { toastCopyError } from "@/utils/copy-to-clipboard";
import {
  availableGeoIngestMethods,
  geoCloudflareAgentPrompt,
  geoIngestAgentPrompt,
} from "@/utils/geo-ingest";

function GeoIngestDocsLink({ method, className }: GeoIngestDocsLinkProps) {
  const t = useTranslations("geo.geoIngestSetup");
  const docs = GEO_INGEST_METHOD_DOCS_URLS[method];
  if (!docs) {
    return null;
  }
  return (
    <a
      className={cn(
        "text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm",
        className
      )}
      href={docs}
      rel="noopener noreferrer"
      target="_blank"
    >
      {t(`docs.${method === "script" ? "script" : "drain"}`)}
      <HugeiconsIcon
        aria-hidden="true"
        className="size-3.5"
        icon={LinkSquare02Icon}
      />
    </a>
  );
}

/** The picked method's one action: rotate the web key or copy an agent prompt. */
function GeoIngestSetupActions({
  method,
  agentPrompt,
  canManage,
  onCopy,
  compact = false,
}: GeoIngestSetupActionsProps) {
  const t = useTranslations("geo.geoIngestSetup");
  const tCommon = useTranslations("common");
  if (method === "script") {
    return canManage ? <WebKeyRotateButton /> : null;
  }
  if (method === "sdk" || method === "cloudflare") {
    return (
      <AgentPromptButton
        copiedLabel={tCommon("labels.promptCopied")}
        label={compact ? t("agentPrompt") : tCommon("labels.copyAgentPrompt")}
        onCopy={() => onCopy(TRAFFIC_INSTALL_COPY_KINDS.AGENT_PROMPT)}
        onCopyError={toastCopyError}
        prompt={agentPrompt}
        size={compact ? "sm" : "default"}
      />
    );
  }
  return null;
}

export function GeoIngestSetup({
  setup,
  className,
  defaultMethod = GEO_INGEST_DEFAULT_METHOD,
  variant = "card",
}: GeoIngestSetupPanelProps) {
  const tInstall = useTranslations("geo.trafficInstall");
  const webFlag = useWebAnalyticsFlag();
  const methods = availableGeoIngestMethods(webFlag.enabled);
  const [selectedMethod, setMethod] = useState(defaultMethod);
  const method = methods.includes(selectedMethod)
    ? selectedMethod
    : GEO_INGEST_DEFAULT_METHOD;
  const [framework, setFramework] = useState(GEO_INGEST_DEFAULT_FRAMEWORK);
  const [packageManager, setPackageManager] = useState(
    GEO_INGEST_DEFAULT_PACKAGE_MANAGER
  );
  const headingId = useId();
  const viewedRef = useRef(false);
  const hasToken = Boolean(setup?.token);

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

  // The method list depends on the flag, so it waits for the server's answer.
  const panels = webFlag.settled ? (
    <div className="flex min-w-0 flex-col gap-6">
      <GeoIngestMethodPicker
        methods={methods}
        onChange={setMethod}
        value={method}
      />
      {method === "vercel" || method === "cloudflare" ? (
        <GeoIngestDrainSetup
          onCopy={() => trackCopied(TRAFFIC_INSTALL_COPY_KINDS.DRAIN_SETUP)}
          provider={method}
          setup={setup}
        />
      ) : null}
      {method === "script" ? (
        <GeoIngestScriptSetup
          onCopy={() => trackCopied(TRAFFIC_INSTALL_COPY_KINDS.SCRIPT_TAG)}
          setup={setup}
        />
      ) : null}
      {method === "sdk" ? (
        <GeoIngestSdkSetup
          framework={framework}
          onCopy={trackCopied}
          onFrameworkChange={setFramework}
          onPackageManagerChange={setPackageManager}
          packageManager={packageManager}
          setup={setup}
        />
      ) : null}
    </div>
  ) : (
    <Skeleton aria-hidden className="h-72 rounded-lg" />
  );

  const actions = (
    <GeoIngestSetupActions
      agentPrompt={
        method === "cloudflare"
          ? geoCloudflareAgentPrompt(setup)
          : geoIngestAgentPrompt(setup, framework, packageManager)
      }
      canManage={Boolean(setup?.canManage && setup.webKey)}
      method={method}
      onCopy={trackCopied}
      compact={variant === "settings"}
    />
  );
  // Docs on the left, the method's one action on the right.
  const footer = (
    <>
      <GeoIngestDocsLink method={method} />
      <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
    </>
  );

  if (variant === "dialog") {
    return (
      <>
        {panels}
        <ResponsiveDialogFooter className="sm:items-center sm:justify-between">
          {footer}
        </ResponsiveDialogFooter>
      </>
    );
  }

  // Settings: no card of its own. A compact agent prompt sits in line with
  // the title; rotating the key is a destructive action, so it stays down
  // by the docs, away from the copy buttons.
  if (variant === "settings") {
    return (
      <section
        aria-labelledby={headingId}
        className={cn("flex min-w-0 flex-col gap-5", className)}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-base font-semibold" id={headingId}>
              {tInstall("title")}
            </h2>
            <p className="text-muted-foreground text-sm text-pretty">
              {tInstall("description")}
            </p>
          </div>
          {method === "script" ? null : (
            <div className="flex shrink-0 items-center">{actions}</div>
          )}
        </div>
        {panels}
        {/* The package method has neither docs nor a footer action. */}
        {method === "sdk" ? null : (
          <div className="flex min-h-8 flex-wrap items-center gap-3">
            <GeoIngestDocsLink method={method} />
            {method === "script" ? (
              <div className="ml-auto flex shrink-0 items-center">
                {actions}
              </div>
            ) : null}
          </div>
        )}
      </section>
    );
  }

  // A flat card on a page: the method, then a muted footer.
  return (
    <section
      className={cn(
        "bg-background min-w-0 overflow-hidden rounded-xl border",
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-5 p-5">{panels}</div>
      <div className="bg-muted/40 flex min-h-12 flex-wrap items-center justify-between gap-3 border-t px-5 py-2.5">
        {footer}
      </div>
    </section>
  );
}
