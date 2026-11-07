"use client";

import { DURATION, EASE, TRANSITION } from "@notra/ui/lib/motion";
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  useReducedMotion,
} from "motion/react";
import { useRef, useState } from "react";
import { useTranslations } from "use-intl";

import ChatInput from "@/components/chat-input";
import { useRightPanel } from "@/components/dashboard/right-panel-context";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { useAgentDraftTarget } from "@/lib/hooks/use-agent-handoff";
import { useAgentPromptBarVisible } from "@/lib/hooks/use-agent-prompt-bar-visible";
import { usePathname } from "@/lib/navigation";
import type { ContentChatInputHandle } from "@/types/components/chat-input";
import { isAutopilotPathname } from "@/utils/dashboard-paths";
import dynamic from "@/utils/lazy-component";

const AutopilotAgentDock = dynamic(
  () =>
    import("@/components/autopilot/autopilot-agent-dock").then(
      (module) => module.AutopilotAgentDock
    ),
  { ssr: false }
);

/**
 * Floating composer on every page: sending opens the agent panel to follow
 * along. On Autopilot it is the agent dock, which grows in place instead.
 */
export function AgentPromptBar() {
  const t = useTranslations("dashboard.agent");
  const { askAgent } = useRightPanel();
  const { activeOrganization } = useOrganizationsContext();
  const pathname = usePathname();
  const onAutopilot = isAutopilotPathname(pathname);
  const barVisible = useAgentPromptBarVisible() && Boolean(activeOrganization);
  const visible = barVisible && !onAutopilot;
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState("");
  // The dock stays mounted after the first visit, so its conversation
  // survives a trip to another page.
  const [dockMounted, setDockMounted] = useState(onAutopilot);
  if (onAutopilot && !dockMounted) {
    setDockMounted(true);
  }
  const inputRef = useRef<ContentChatInputHandle | null>(null);

  useAgentDraftTarget(visible, (text) => {
    setValue(text);
    // Focus once the new text has rendered, so the caret lands after it.
    window.requestAnimationFrame(() => inputRef.current?.focus());
  });

  // Moves only a few pixels: the panel opening is the main event, not this.
  const offset = (px: number) =>
    reduceMotion ? "translateY(0px)" : `translateY(${px}px)`;
  // The page narrows or widens while the panel slides, which would drag the
  // bar sideways: leave fast with ease-out, and come back once it settles.
  const exitTransition = { duration: DURATION.instant, ease: EASE.out };
  const enterTransition = { ...TRANSITION.enter, delay: DURATION.fast };

  return (
    <>
      {dockMounted && activeOrganization ? (
        <AutopilotAgentDock
          hidden={!(barVisible && onAutopilot)}
          key={activeOrganization.id}
          organizationId={activeOrganization.id}
          organizationSlug={activeOrganization.slug}
        />
      ) : null}
      <LazyMotion features={domAnimation} strict>
        <AnimatePresence initial={false}>
          {visible && activeOrganization ? (
            <m.div
              animate={{ opacity: 1, transform: offset(0) }}
              className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-4"
              exit={{ opacity: 0, transition: exitTransition }}
              initial={{ opacity: 0, transform: offset(8) }}
              key="agent-prompt-bar"
              transition={enterTransition}
            >
              <div className="pointer-events-auto w-full max-w-2xl">
                <ChatInput
                  layout="pill"
                  onSend={(text, attachments) =>
                    askAgent(text, { attachments })
                  }
                  onValueChange={setValue}
                  organizationId={activeOrganization.id}
                  organizationSlug={activeOrganization.slug}
                  placeholder={t("placeholder")}
                  ref={inputRef}
                  value={value}
                />
              </div>
            </m.div>
          ) : null}
        </AnimatePresence>
      </LazyMotion>
    </>
  );
}
