"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Slack } from "@notra/ui/components/ui/svgs/slack";
import { isDemoModeClient } from "@notra/utils/demo-mode";
import { useQuery } from "@tanstack/react-query";
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  useReducedMotion,
} from "motion/react";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { AddSlackIntegrationDialog } from "@/components/integrations/add-slack-integration-dialog";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { localStorageKeys } from "@/constants/storage";
import { useIsClient } from "@/lib/hooks/use-is-client";
import { useStoredDismissal } from "@/lib/hooks/use-stored-dismissal";
import { dashboardOrpc } from "@/lib/orpc/query";

import { DismissButton, PILL_TRANSITION, pillMotion } from "./connect-agent";

const SLACK_STATUS_STALE_TIME_MS = 5 * 60 * 1000;

/**
 * Sidebar pill that installs the Notra agent in Slack. It only shows while
 * the workspace has no Slack integration, and the dismissal is kept per
 * workspace because Slack is connected per workspace.
 */
export function ConnectSlackPill() {
  const t = useTranslations("connectSlack");
  const reduceMotion = useReducedMotion();
  const isClient = useIsClient();
  const { activeOrganization } = useOrganizationsContext();
  const organizationId = activeOrganization?.id ?? "";
  const { dismissed, dismiss } = useStoredDismissal(
    localStorageKeys.connectSlackDismissed(organizationId)
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const enabled =
    isClient && !!organizationId && !dismissed && !isDemoModeClient();

  const { data } = useQuery(
    dashboardOrpc.integrations.slack.list.queryOptions({
      input: { organizationId },
      enabled,
      staleTime: SLACK_STATUS_STALE_TIME_MS,
    })
  );
  const visible = enabled && data?.integrations.length === 0;

  const callbackPath = `/${activeOrganization?.slug ?? ""}/integrations/slack`;
  const authorizeUrl = `/api/integrations/slack/authorize?organizationId=${organizationId}&callbackPath=${encodeURIComponent(callbackPath)}`;

  return (
    <>
      <LazyMotion features={domAnimation} strict>
        <AnimatePresence initial={false}>
          {visible ? (
            <m.div
              className="group/agent relative pb-1.5 group-data-[collapsible=icon]:hidden"
              transition={PILL_TRANSITION}
              {...pillMotion(reduceMotion)}
            >
              <button
                className="border-sidebar-border bg-background text-sidebar-foreground hover:bg-sidebar-accent focus-visible:ring-sidebar-ring duration-fast flex h-9 w-full cursor-pointer items-center gap-2 overflow-hidden rounded-full border ps-1 pe-3 text-sm font-medium transition ease-out outline-none focus-visible:ring-2 active:scale-[0.97] motion-reduce:transition-none"
                onClick={() => setDialogOpen(true)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="bg-background border-foreground/15 grid size-7 shrink-0 place-items-center rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_0_8px_rgba(255,255,255,0.08)]"
                >
                  <Slack className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-start">
                  {t("label")}
                </span>
                <HugeiconsIcon
                  aria-hidden="true"
                  className="text-muted-foreground size-3.5 shrink-0"
                  icon={ArrowRight01Icon}
                />
              </button>
              <DismissButton label={t("dismiss")} onDismiss={dismiss} />
            </m.div>
          ) : null}
        </AnimatePresence>
      </LazyMotion>
      {visible ? (
        <AddSlackIntegrationDialog
          authorizeUrl={authorizeUrl}
          onOpenChange={setDialogOpen}
          open={dialogOpen}
        />
      ) : null}
    </>
  );
}
