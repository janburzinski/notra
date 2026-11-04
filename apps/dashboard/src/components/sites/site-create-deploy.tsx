"use client";

import { useTranslations } from "use-intl";

import { SiteCreateDeployActions } from "@/components/sites/site-create-deploy-actions";
import { SiteCreateDeployHeading } from "@/components/sites/site-create-deploy-heading";
import { SiteCreateDeployStep } from "@/components/sites/site-create-deploy-step";
import { SITE_CREATE_DEPLOY_PHASE_TONES } from "@/constants/site-create";
import { useNow } from "@/lib/hooks/use-now";
import { useSiteCreateDeployment } from "@/lib/hooks/use-site-create-deployment";
import type { SiteCreateDeployProps } from "@/types/components/sites";
import { toErrorMessage } from "@/utils/error-message";
import {
  deploymentFailureSummary,
  logWithFailure,
  siteCreateDeployHeadlineKey,
  siteCreateDeployState,
  siteCreateDeployTiming,
} from "@/utils/site-create-deploy";
import { siteHref } from "@/utils/site-links";

export function SiteCreateDeploy({
  organizationId,
  organizationSlug,
  site,
  deploymentQueued,
  state: stepState,
  title,
  children,
}: SiteCreateDeployProps) {
  const t = useTranslations("sites.new.deploy");
  const deploy = useSiteCreateDeployment({
    organizationId,
    siteId: site?.id ?? "",
    deploymentQueued,
  });
  const { queued, record, lookupFailed, retry } = deploy;
  const state = siteCreateDeployState({ queued, lookupFailed, record });
  const { phase, status, inProgress, failed } = state;
  const buildLog = failed
    ? logWithFailure(
        deploy.log,
        deploymentFailureSummary(record) ?? t("failureRecovery")
      )
    : deploy.log;
  const now = useNow(site !== null && inProgress);
  if (!site) {
    return (
      <SiteCreateDeployStep deploy={null} state={stepState} title={title}>
        {children}
      </SiteCreateDeployStep>
    );
  }
  const { elapsed, startedSeconds } = siteCreateDeployTiming(record, now);
  const headline = t(siteCreateDeployHeadlineKey(state, queued, !!record), {
    seconds: startedSeconds,
    duration: elapsed ?? "",
  });
  const view = {
    actions: (
      <SiteCreateDeployActions
        isReloadingStatus={deploy.isReloadingStatus}
        isRetrying={retry.isPending}
        liveUrl={site.liveUrl}
        onReloadStatus={deploy.reloadStatus}
        onRetry={deploy.retryDeployment}
        overviewHref={siteHref(
          organizationSlug,
          site.id,
          "overview",
          site.projectId
        )}
        phase={phase}
        settingsHref={siteHref(
          organizationSlug,
          site.id,
          "settings",
          site.projectId
        )}
      />
    ),
    error: retry.isError ? toErrorMessage(retry.error, t("retryFailed")) : null,
    heading: (
      <SiteCreateDeployHeading
        headline={headline}
        tone={SITE_CREATE_DEPLOY_PHASE_TONES[phase]}
      />
    ),
    inProgress,
    log: buildLog || null,
    lookupFailed,
    queued: !failed && (!record || status === "queued"),
  };
  return <SiteCreateDeployStep deploy={view} state={stepState} title={title} />;
}
