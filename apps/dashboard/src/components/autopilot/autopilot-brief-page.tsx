"use client";

import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { Github } from "@notra/ui/components/ui/svgs/github";
import { Notra } from "@notra/ui/components/ui/svgs/notra";
import { Slack } from "@notra/ui/components/ui/svgs/slack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useState } from "react";
import { TABLE_BODY_CLASS, TABLE_FRAME_CLASS } from "ui/table/constants";
import { useFormatter } from "use-intl";

import {
  AutopilotBriefFindingCard,
  AutopilotBriefFindingList,
} from "@/components/autopilot/autopilot-brief-finding-card";
import {
  AutopilotBriefScene,
  AutopilotBriefSceneSwitcher,
} from "@/components/autopilot/autopilot-brief-scene";
import { AutopilotFindingConfirmDialog } from "@/components/autopilot/autopilot-finding-confirm-dialog";
import { AutopilotTableEmpty } from "@/components/autopilot/autopilot-table-empty";
import { buttonVariants } from "@/components/button";
import Link from "@/components/framework/link";
import {
  AUTOPILOT_NAV_LINK,
  AUTOPILOT_POLL_INTERVAL_MS,
} from "@/constants/autopilot";
import {
  AUTOPILOT_BRIEF_PARAGRAPH_BREAK,
  AUTOPILOT_BRIEF_REFRESH_MS,
  AUTOPILOT_BRIEF_SOURCES,
} from "@/constants/autopilot-brief";
import { useAutopilotActions } from "@/lib/hooks/use-autopilot";
import { dashboardOrpc } from "@/lib/orpc/query";
import { cn } from "@/lib/utils";
import type {
  AutopilotBriefHeadingProps,
  AutopilotBriefHeroProps,
  AutopilotBriefItemsProps,
  AutopilotBriefPageProps,
  AutopilotFindingView,
  AutopilotPendingFindingAction,
} from "@/types/autopilot";
import {
  groupBriefFindings,
  isFindingPending,
  listSeparator,
} from "@/utils/autopilot-brief";
import { briefSceneIndex } from "@/utils/brief-scenes";
import { toErrorMessage } from "@/utils/error-message";

const SECTION_HEADING = "text-base font-semibold tracking-tight";
const BODY_TEXT = "text-muted-foreground text-sm/6 text-pretty";

/**
 * The daily brief as a plain page, outside the dashboard. Reads like a short
 * letter: the one call to make first, what the rest of the day looks like,
 * and every pull request or idea with its button. Deciding here and reacting
 * in Slack act on the same item.
 */
export function AutopilotBriefPage({
  briefId,
  organizationId,
  organizationSlug,
  organizationName,
}: AutopilotBriefPageProps) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<AutopilotPendingFindingAction | null>(
    null
  );
  const query = useQuery({
    ...dashboardOrpc.autopilot.brief.queryOptions({
      input: { organizationId, briefId },
    }),
    // A write in flight turns into a pull request soon; items still waiting
    // can be decided in Slack or on GitHub at any time.
    refetchInterval: (state) => {
      const findings = state.state.data?.findings ?? [];
      if (findings.some((finding) => finding.status === "open")) {
        return AUTOPILOT_POLL_INTERVAL_MS;
      }
      return findings.some(isFindingPending)
        ? AUTOPILOT_BRIEF_REFRESH_MS
        : false;
    },
    refetchOnWindowFocus: "always",
  });
  // Dev only: the switcher in the corner picks a scene to review them all.
  const [sceneOverride, setSceneOverride] = useState<number | null>(null);
  const autopilotHref = `/${organizationSlug}${AUTOPILOT_NAV_LINK}`;
  const data = query.data;

  // Admins check GitHub once per visit, like the dashboard, so pull requests
  // merged or closed there since the brief went out don't look open here.
  const canSync = Boolean(data?.canManage);
  useEffect(() => {
    if (!canSync) {
      return;
    }
    dashboardOrpc.autopilot.sync
      .call({ organizationId })
      .then(() =>
        queryClient.invalidateQueries({
          queryKey: dashboardOrpc.autopilot.key(),
        })
      )
      .catch(() => undefined);
  }, [canSync, organizationId, queryClient]);

  const groups = data ? groupBriefFindings(data) : null;
  const sceneIndex = data
    ? (sceneOverride ?? briefSceneIndex(new Date(data.createdAt)))
    : null;

  let hero = null;
  let body = null;
  if (query.isPending) {
    hero = (
      <div aria-busy="true" className="space-y-4" role="status">
        <span className="sr-only">Loading the brief</span>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
    body = <Skeleton className="h-28 w-full rounded-2xl" />;
  } else if (data && groups) {
    hero = (
      <BriefHero
        autopilotHref={autopilotHref}
        brief={data}
        asked={groups.asked.length}
        waiting={groups.asked.filter(isFindingPending).length}
      />
    );
    body = (
      <BriefItems
        autopilotHref={autopilotHref}
        brief={data}
        groups={groups}
        onDismiss={(finding) => setPending({ kind: "dismiss", finding })}
        organizationId={organizationId}
        organizationSlug={organizationSlug}
      />
    );
  } else {
    body = (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">This brief couldn't be loaded</h1>
        <p className="text-muted-foreground text-sm">
          {toErrorMessage(query.error, "Something went wrong.")}{" "}
          <button
            className="text-foreground underline-offset-4 hover:underline"
            onClick={() => query.refetch()}
            type="button"
          >
            Try again
          </button>
        </p>
      </div>
    );
  }

  return (
    <main className="bg-background min-h-svh">
      <div className="mx-auto w-full max-w-2xl px-4 pt-6 pb-24 sm:pt-8">
        <nav
          aria-label="Brief"
          className="mb-6 flex items-center justify-between gap-3 text-sm sm:mb-8"
        >
          <Link
            className="flex min-w-0 items-center gap-2 font-medium"
            href={autopilotHref}
          >
            <span className="dark:bg-foreground flex size-5 shrink-0 items-center justify-center rounded-sm">
              <Notra className="size-4.5 dark:size-4" />
            </span>
            <span className="truncate">{organizationName}</span>
          </Link>
          {data?.slackUrl ? (
            <a
              className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1.5 transition-colors"
              href={data.slackUrl}
              rel="noreferrer"
              target="_blank"
            >
              <Slack aria-hidden="true" className="size-3.5" />
              Back to Slack
            </a>
          ) : null}
        </nav>
        {hero ? (
          <div className={TABLE_FRAME_CLASS}>
            <div className={cn(TABLE_BODY_CLASS, "overflow-hidden")}>
              <AutopilotBriefScene index={sceneIndex} />
              <div className="border-table-card-border border-t px-5 pt-6 pb-6 sm:px-8 sm:pt-7 sm:pb-8">
                {hero}
              </div>
            </div>
          </div>
        ) : null}
        <div className={hero ? "mt-12" : undefined}>{body}</div>
      </div>
      {import.meta.env.DEV && sceneIndex !== null ? (
        <AutopilotBriefSceneSwitcher
          index={sceneIndex}
          onChange={setSceneOverride}
        />
      ) : null}
      <AutopilotFindingConfirmDialog
        branch={data?.branch ?? null}
        onClose={() => setPending(null)}
        organizationId={organizationId}
        pending={pending}
      />
    </main>
  );
}

function BriefHeading({ id, title, description }: AutopilotBriefHeadingProps) {
  return (
    <div className="space-y-1">
      <h2 className={SECTION_HEADING} id={id}>
        {title}
      </h2>
      {description?.split(AUTOPILOT_BRIEF_PARAGRAPH_BREAK).map((paragraph) => (
        <p className={BODY_TEXT} key={paragraph}>
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function BriefHero({
  brief,
  asked,
  waiting,
  autopilotHref,
}: AutopilotBriefHeroProps) {
  const format = useFormatter();
  const createdAt = new Date(brief.createdAt);
  return (
    <header>
      <p className="flex items-center gap-2 text-sm">
        <span className="text-foreground font-medium">Daily brief</span>
        <span aria-hidden="true" className="bg-border h-3.5 w-px" />
        <time
          className="text-muted-foreground"
          dateTime={createdAt.toISOString()}
        >
          {format.dateTime(createdAt, {
            weekday: "long",
            month: "short",
            day: "numeric",
            timeZone: brief.timeZone,
          })}
        </time>
      </p>
      <h1 className="mt-4 text-2xl/tight font-semibold tracking-tight text-balance sm:text-4xl/tight">
        {brief.content.headline}
      </h1>
      <p className="text-muted-foreground mt-3 text-sm/6 text-pretty sm:text-base/7">
        {brief.content.summary}
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {waiting > 0 ? (
          <a className={buttonVariants({ size: "sm" })} href="#brief-items">
            Review {waiting} {waiting === 1 ? "item" : "items"}
          </a>
        ) : null}
        {waiting === 0 && asked > 0 ? (
          <p className="text-muted-foreground mr-2 inline-flex items-center gap-1.5 text-sm">
            <HugeiconsIcon
              aria-hidden="true"
              className="text-success"
              icon={CheckmarkCircle02Icon}
              size={16}
              strokeWidth={2}
            />
            All decided
          </p>
        ) : null}
        <Link
          className={buttonVariants({ size: "sm", variant: "outline" })}
          href={autopilotHref}
        >
          Open Autopilot
        </Link>
      </div>
    </header>
  );
}

function BriefItems({
  brief,
  groups,
  organizationId,
  organizationSlug,
  autopilotHref,
  onDismiss,
}: AutopilotBriefItemsProps) {
  const { merge, writeSuggestion } = useAutopilotActions(organizationId);
  const { content } = brief;
  const list = (rows: AutopilotFindingView[]) =>
    rows.length > 0 ? (
      <div className="mt-4">
        <AutopilotBriefFindingList>
          {rows.map((finding) => (
            <AutopilotBriefFindingCard
              canManage={brief.canManage}
              canWrite={brief.canWrite}
              finding={finding}
              key={finding.id}
              merging={
                merge.isPending && merge.variables?.findingId === finding.id
              }
              onDismiss={() => onDismiss(finding)}
              onMerge={(method) =>
                merge.mutate({ findingId: finding.id, method })
              }
              onWrite={() => writeSuggestion.mutate(finding.id)}
              organizationSlug={organizationSlug}
              timeZone={brief.timeZone}
              writing={
                writeSuggestion.isPending &&
                writeSuggestion.variables === finding.id
              }
            />
          ))}
        </AutopilotBriefFindingList>
      </div>
    ) : null;

  const empty =
    !groups.lead &&
    groups.sections.length === 0 &&
    groups.rest.length === 0 &&
    groups.merged.length === 0 &&
    content.insights.length === 0;
  if (empty) {
    return (
      <AutopilotBriefFindingList>
        <AutopilotTableEmpty
          description="Nothing on it is left to show. Autopilot posts a new brief when there's something to decide."
          icon={CheckmarkCircle02Icon}
          title="This brief is empty"
        />
      </AutopilotBriefFindingList>
    );
  }

  return (
    <article className="scroll-mt-8 space-y-10" id="brief-items">
      {groups.lead && content.lead ? (
        <section aria-labelledby="brief-lead">
          <BriefHeading
            description={content.lead.why}
            id="brief-lead"
            title="Decide this first"
          />
          {list([groups.lead])}
        </section>
      ) : null}

      {groups.sections.map((section, index) => (
        <section aria-labelledby={`brief-section-${index}`} key={section.key}>
          <BriefHeading
            description={section.body}
            id={`brief-section-${index}`}
            title={section.title}
          />
          {list(section.rows)}
        </section>
      ))}

      {groups.rest.length > 0 ? (
        <section aria-labelledby="brief-rest">
          <BriefHeading
            id="brief-rest"
            title={
              groups.lead || groups.sections.length > 0
                ? "Also waiting for you"
                : "Your call"
            }
          />
          {list(groups.rest)}
        </section>
      ) : null}

      {groups.merged.length > 0 ? (
        <section aria-labelledby="brief-merged">
          <BriefHeading id="brief-merged" title="Merged since the last brief" />
          {list(groups.merged)}
        </section>
      ) : null}

      {content.insights.length > 0 ? (
        <section aria-labelledby="brief-insights">
          <BriefHeading id="brief-insights" title="Worth knowing" />
          <ol className="mt-3 space-y-2">
            {content.insights.map((insight, index) => (
              <li
                className="grid grid-cols-[1.75rem_1fr] items-baseline"
                key={insight}
              >
                <span
                  aria-hidden="true"
                  className="text-muted-foreground/70 font-mono text-xs tabular-nums"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className={BODY_TEXT}>{insight}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <BriefFooter
        autopilotHref={autopilotHref}
        brief={brief}
        groups={groups}
      />
    </article>
  );
}

function BriefFooter({
  brief,
  groups,
  autopilotHref,
}: Pick<AutopilotBriefItemsProps, "brief" | "groups" | "autopilotHref">) {
  const blocked = groups.asked.some(isFindingPending);
  const sources = [
    ...new Set(
      [...groups.asked, ...groups.merged].map(
        (finding) => AUTOPILOT_BRIEF_SOURCES[finding.kind]
      )
    ),
  ];
  const ideaWaiting = groups.asked.some(
    (finding) => finding.status === "suggested"
  );
  return (
    <footer className="space-y-3 border-t pt-6">
      {blocked && !brief.canManage ? (
        <p className="text-muted-foreground text-sm">
          Only workspace admins can merge, write or close these.
        </p>
      ) : null}
      {brief.canManage && !brief.canWrite && ideaWaiting ? (
        <p className="text-muted-foreground text-sm">
          Autopilot is off, so ideas can't be written until you{" "}
          <Link
            className="text-foreground underline-offset-4 hover:underline"
            href={autopilotHref}
          >
            turn it on
          </Link>
          .
        </p>
      ) : null}
      {sources.length > 0 ? (
        <p className="text-muted-foreground text-xs text-pretty">
          From your{" "}
          {sources.map((source, index) => (
            <Fragment key={source}>
              {listSeparator(index, sources.length)}
              {source === "GitHub" ? (
                <span className="inline-flex items-center gap-1 align-bottom">
                  <Github aria-hidden="true" className="size-3" />
                  GitHub
                </span>
              ) : (
                source
              )}
            </Fragment>
          ))}
          .
        </p>
      ) : null}
    </footer>
  );
}
