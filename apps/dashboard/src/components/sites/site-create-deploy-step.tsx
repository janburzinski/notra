"use client";

import { SiteBuildLogs } from "@/components/sites/site-build-logs";
import { SiteCreateStep } from "@/components/sites/site-create-step";
import type { SiteCreateDeployStepProps } from "@/types/components/sites";

export function SiteCreateDeployStep({
  state,
  title,
  deploy,
  children,
}: SiteCreateDeployStepProps) {
  return (
    <SiteCreateStep
      flush={deploy !== null}
      footer={deploy?.actions}
      state={state}
      title={title}
    >
      {deploy ? (
        <>
          {deploy.lookupFailed ? (
            <div className="flex min-h-12 items-center px-4 text-sm">
              {deploy.heading}
            </div>
          ) : (
            <SiteBuildLogs
              heading={deploy.heading}
              inProgress={deploy.inProgress}
              log={deploy.log}
              queued={deploy.queued}
            />
          )}
          {deploy.error ? (
            <p
              className="text-foreground border-t px-4 py-3 text-sm [overflow-wrap:anywhere]"
              role="alert"
            >
              {deploy.error}
            </p>
          ) : null}
        </>
      ) : (
        children
      )}
    </SiteCreateStep>
  );
}
