"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { AgentPromptButton } from "@notra/ui/components/ui/agent-prompt-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  useReducedMotion,
} from "motion/react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { localStorageKeys } from "@/constants/storage";
import { trackEvent } from "@/lib/analytics/posthog-client";
import { useIsClient } from "@/lib/hooks/use-is-client";
import { useStoredDismissal } from "@/lib/hooks/use-stored-dismissal";
import type { ConnectAgentDismissButtonProps } from "@/types/connect-agent";
import { getConnectAgentPrompt } from "@/utils/connect-agent";
import { toastCopyError } from "@/utils/copy-to-clipboard";

const PILL_HIDDEN = { opacity: 0, height: 0, paddingBottom: 0, scale: 0.96 };
const PILL_SHOWN = { opacity: 1, height: "auto", paddingBottom: 6, scale: 1 };

const PILL_TRANSITION = {
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1],
  opacity: { duration: 0.12 },
} as const;

function pillMotion(reduceMotion: boolean | null) {
  if (reduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    };
  }
  return { initial: PILL_HIDDEN, animate: PILL_SHOWN, exit: PILL_HIDDEN };
}

function DismissButton({ label, onDismiss }: ConnectAgentDismissButtonProps) {
  return (
    <button
      aria-label={label}
      className="border-sidebar-border bg-background text-muted-foreground hover:text-foreground focus-visible:ring-sidebar-ring pointer-events-none absolute -top-1.5 -right-1 grid size-5 scale-90 cursor-pointer place-items-center rounded-full border opacity-0 shadow-xs transition-[opacity,scale,color] duration-150 ease-out outline-none group-hover/agent:pointer-events-auto group-hover/agent:scale-100 group-hover/agent:opacity-100 focus-visible:pointer-events-auto focus-visible:scale-100 focus-visible:opacity-100 focus-visible:ring-2 motion-reduce:transition-none [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:scale-100 [@media(hover:none)]:opacity-100"
      onClick={onDismiss}
      type="button"
    >
      <HugeiconsIcon className="size-3" icon={Cancel01Icon} />
    </button>
  );
}

function useConnectAgentPrompt() {
  const t = useTranslations("connectAgent");
  const { activeOrganization } = useOrganizationsContext();
  const prompt = getConnectAgentPrompt(activeOrganization);

  function onCopied() {
    toast.success(t("toast"));
    trackEvent(POSTHOG_EVENTS.AGENT_ONBOARD_PROMPT_COPIED);
  }

  return { prompt, onCopied };
}

export function ConnectAgentPill() {
  const t = useTranslations("connectAgent");
  const tCommon = useTranslations("common");
  const reduceMotion = useReducedMotion();
  // The dismissal lives in localStorage, which the server can't read, so the
  // pill only renders in the browser to avoid flashing for dismissed users.
  const isClient = useIsClient();
  const { dismissed, dismiss } = useStoredDismissal(
    localStorageKeys.connectAgentDismissed
  );
  const { prompt, onCopied } = useConnectAgentPrompt();
  const visible = isClient && !dismissed;

  function handleDismiss() {
    dismiss();
    trackEvent(POSTHOG_EVENTS.AGENT_ONBOARD_PROMPT_DISMISSED);
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence initial={false}>
        {visible ? (
          <m.div
            className="group/agent relative pb-1.5 group-data-[collapsible=icon]:hidden"
            transition={PILL_TRANSITION}
            {...pillMotion(reduceMotion)}
          >
            <Tooltip>
              <TooltipTrigger
                render={
                  <AgentPromptButton
                    copiedLabel={tCommon("actions.copied")}
                    label={t("label")}
                    onCopy={onCopied}
                    onCopyError={toastCopyError}
                    prompt={prompt}
                    variant="sidebar"
                  />
                }
              />
              <TooltipContent className="max-w-64" side="right" sideOffset={8}>
                {prompt}
              </TooltipContent>
            </Tooltip>
            <DismissButton label={t("dismiss")} onDismiss={handleDismiss} />
          </m.div>
        ) : null}
      </AnimatePresence>
    </LazyMotion>
  );
}
