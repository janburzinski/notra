"use client";

import {
  ArrowUpRight01Icon,
  Cancel01Icon,
  News01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { EASE } from "@notra/ui/lib/motion";
import { cn } from "@notra/ui/lib/utils";
import { isDemoModeClient } from "@notra/utils/demo-mode";
import { useQuery } from "@tanstack/react-query";
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  useReducedMotion,
} from "motion/react";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "use-intl";

import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { localStorageKeys } from "@/constants/storage";
import { useAgentPromptBarVisible } from "@/lib/hooks/use-agent-prompt-bar-visible";
import { useStoredDismissal } from "@/lib/hooks/use-stored-dismissal";
import { dashboardOrpc } from "@/lib/orpc/query";

/**
 * The card stays mounted across pages, so it asks again on this interval and
 * when the tab regains focus: a brief written while the dashboard is open
 * shows up, and yesterday's leaves after midnight.
 */
const TODAY_BRIEF_REFRESH_MS = 5 * 60 * 1000;
/**
 * The card isn't there on load: it pops in once the page has settled, so it
 * reads as news rather than as part of the page.
 */
const ARRIVE_DELAY_S = 2.5;
/** A spring with a little overshoot, growing out of the corner it sits in. */
const ARRIVE_TRANSITION = {
  type: "spring",
  visualDuration: 0.5,
  bounce: 0.5,
  delay: ARRIVE_DELAY_S,
  // Fading in doesn't bounce.
  opacity: { duration: 0.15, delay: ARRIVE_DELAY_S },
} as const;

/**
 * Floats in the bottom-right corner when Autopilot wrote today's brief: a
 * line saying it is ready over a shrunken render of the brief page. Opening
 * or hiding it puts it away for that brief only, so tomorrow's arrives
 * again, and yesterday's never shows.
 */
export function DailyBriefOverlay() {
  const t = useTranslations("nav.dailyBrief");
  const format = useFormatter();
  const reduceMotion = useReducedMotion();
  // The Autopilot page's composer floats at the bottom; sit above it.
  const promptBarVisible = useAgentPromptBarVisible();
  const { activeOrganization } = useOrganizationsContext();
  const organizationId = activeOrganization?.id ?? "";

  // Turned off from the toast after hiding a brief; kept per workspace.
  const {
    dismissed: off,
    dismiss: turnOff,
    restore: turnOn,
  } = useStoredDismissal(localStorageKeys.dailyBriefOff(organizationId));

  const { data: brief } = useQuery(
    dashboardOrpc.autopilot.todayBrief.queryOptions({
      input: { organizationId },
      enabled: !!organizationId && !isDemoModeClient() && !off,
      staleTime: TODAY_BRIEF_REFRESH_MS,
      refetchInterval: TODAY_BRIEF_REFRESH_MS,
      refetchOnWindowFocus: true,
    })
  );
  const briefId = brief?.id ?? "";
  const { dismissed, dismiss } = useStoredDismissal(
    localStorageKeys.dailyBriefDismissed(briefId)
  );
  const visible = !!brief && !dismissed && !off;

  function hide() {
    dismiss();
    toast(t("hidden"), {
      action: {
        label: t("turnOff"),
        onClick: () => {
          turnOff();
          toast(t("turnedOff"), {
            action: { label: t("undo"), onClick: turnOn },
          });
        },
      },
    });
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence>
        {visible ? (
          <m.aside
            animate={{ opacity: 1, y: 0, scale: 1 }}
            aria-label={t("label")}
            className={cn(
              "group/brief fixed right-4 z-40 w-72 max-w-[calc(100vw-2rem)] origin-bottom-right",
              promptBarVisible ? "bottom-24" : "bottom-4"
            )}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    y: 8,
                    scale: 0.98,
                    transition: { duration: 0.15, ease: EASE.out },
                  }
            }
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, y: 32, scale: 0.8 }
            }
            key={brief.id}
            transition={
              reduceMotion
                ? { duration: 0.2, delay: ARRIVE_DELAY_S }
                : ARRIVE_TRANSITION
            }
          >
            <a
              className="border-border bg-background ring-muted dark:ring-muted/60 focus-visible:ring-ring block rounded-2xl border p-2 ring-4 outline-none [corner-shape:squircle] focus-visible:ring-2"
              href={brief.href}
              onClick={dismiss}
            >
              <span className="flex items-center gap-2 px-2 pt-1 pb-2.5">
                <HugeiconsIcon
                  aria-hidden="true"
                  className="text-muted-foreground size-4 shrink-0"
                  icon={News01Icon}
                />
                <span className="text-foreground min-w-0 truncate text-sm font-medium">
                  {t("ready")}
                </span>
                <HugeiconsIcon
                  aria-hidden="true"
                  className="text-muted-foreground -ms-1 size-4 shrink-0"
                  icon={ArrowUpRight01Icon}
                />
              </span>
              {/* A screenshot-like peek: the page is laid out at full size,
                  scaled down and cut off by the frame. */}
              <span className="bg-muted/60 relative block h-64 overflow-hidden rounded-xl [corner-shape:squircle]">
                <span className="bg-background absolute top-3.5 left-3.5 block w-[32rem] origin-top-left scale-[0.46] rounded-2xl p-9 shadow-sm">
                  <span className="text-muted-foreground block text-sm">
                    {t("label")} ·{" "}
                    {format.dateTime(new Date(brief.createdAt), {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="text-foreground mt-2 block text-3xl leading-tight font-semibold tracking-tight">
                    {brief.headline}
                  </span>
                  <span className="text-muted-foreground mt-3 line-clamp-3 block text-base leading-relaxed">
                    {brief.summary}
                  </span>
                  <span className="mt-6 flex flex-col gap-3">
                    {brief.items.map((item) => (
                      <span
                        className="border-border block rounded-xl border p-4"
                        key={item.id}
                      >
                        <span className="text-foreground block text-base font-medium">
                          {item.title}
                        </span>
                        <span className="bg-muted mt-2.5 block h-2.5 w-3/4 rounded-full" />
                      </span>
                    ))}
                  </span>
                  {brief.sectionTitles.slice(0, 2).map((title) => (
                    <span className="mt-6 block" key={title}>
                      <span className="text-foreground block text-lg font-semibold">
                        {title}
                      </span>
                      <span className="bg-muted mt-2.5 block h-2.5 w-full rounded-full" />
                      <span className="bg-muted mt-2 block h-2.5 w-5/6 rounded-full" />
                    </span>
                  ))}
                </span>
              </span>
            </a>
            <button
              aria-label={t("dismiss")}
              className="border-border bg-background text-muted-foreground hover:text-foreground focus-visible:ring-ring pointer-events-none absolute -top-2 -left-1.5 grid size-5 scale-90 cursor-pointer place-items-center rounded-full border opacity-0 shadow-xs transition-[opacity,scale,color] duration-150 ease-out outline-none group-hover/brief:pointer-events-auto group-hover/brief:scale-100 group-hover/brief:opacity-100 focus-visible:pointer-events-auto focus-visible:scale-100 focus-visible:opacity-100 focus-visible:ring-2 motion-reduce:transition-none [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:scale-100 [@media(hover:none)]:opacity-100"
              onClick={hide}
              type="button"
            >
              <HugeiconsIcon className="size-3" icon={Cancel01Icon} />
            </button>
          </m.aside>
        ) : null}
      </AnimatePresence>
    </LazyMotion>
  );
}
