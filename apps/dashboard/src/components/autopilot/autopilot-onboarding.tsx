"use client";

import { GithubIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { EASE } from "@notra/ui/lib/motion";
import { cn } from "@notra/ui/lib/utils";
import type { UIMessage } from "ai";
import { domAnimation, LazyMotion, m, useReducedMotion } from "motion/react";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "use-intl";

import { AgentQuestionDock } from "@/components/ai/agent-question-dock";
import { AutopilotFooterSwap } from "@/components/autopilot/autopilot-footer-swap";
import { AutopilotSetupProgress } from "@/components/autopilot/autopilot-setup-progress";
import { OllieGuide } from "@/components/autopilot/ollie-guide";
import { Button } from "@/components/button";
import { ChatConversation } from "@/components/chat/chat-conversation";
import { ChatInput } from "@/components/chat/chat-input";
import {
  AUTOPILOT_ONBOARDING_ANCHOR_ATTRIBUTE,
  AUTOPILOT_ONBOARDING_DOCK_DELAY_MS,
  AUTOPILOT_ONBOARDING_ENDING as ENDING,
  AUTOPILOT_ONBOARDING_LAYER_ID,
  AUTOPILOT_ONBOARDING_PAUSE_MS,
  AUTOPILOT_ONBOARDING_TOOLS,
  AUTOPILOT_ONBOARDING_TYPE_CHARS_PER_SECOND,
} from "@/constants/autopilot-onboarding";
import { useAutopilotOnboarding } from "@/lib/hooks/use-autopilot-onboarding";
import { setAutopilotOnboardingActive } from "@/lib/hooks/use-autopilot-onboarding-active";
import { useOllieTypewriter } from "@/lib/hooks/use-ollie-typewriter";
import type {
  AutopilotOnboardingMessage,
  AutopilotOnboardingProps,
  OllieMood,
} from "@/types/autopilot-onboarding";
import type { ChatCustomTools } from "@/types/components/chat-conversation";
import { randomBetween } from "@/utils/autopilot-onboarding";

/**
 * Ollie's line as it's typed, a whole word at a time like a streamed reply,
 * so the chat's own word fade carries it.
 */
function useTypedText(
  message: { id: string; text: string } | null,
  onDone: (id: string) => void
) {
  const reduceMotion = useReducedMotion() ?? false;
  const [typed, setTyped] = useState({ id: "", chars: 0 });
  const finish = useEffectEvent(onDone);
  const id = message?.id ?? null;
  const text = message?.text ?? "";

  useEffect(() => {
    if (!id) {
      return;
    }
    let frame = 0;
    let pause = 0;
    if (reduceMotion) {
      setTyped({ id, chars: text.length });
      pause = window.setTimeout(() => finish(id), 0);
      return () => window.clearTimeout(pause);
    }
    const start = performance.now();
    // Each line at its own pace, like someone talking.
    const speed = randomBetween(AUTOPILOT_ONBOARDING_TYPE_CHARS_PER_SECOND);
    const tick = (now: number) => {
      const raw = ((now - start) / 1000) * speed;
      const chars =
        raw >= text.length
          ? text.length
          : text.lastIndexOf(" ", Math.floor(raw)) + 1;
      setTyped((current) =>
        current.id === id && current.chars === chars ? current : { id, chars }
      );
      if (raw < text.length) {
        frame = window.requestAnimationFrame(tick);
      } else {
        pause = window.setTimeout(
          () => finish(id),
          randomBetween(AUTOPILOT_ONBOARDING_PAUSE_MS)
        );
      }
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(pause);
    };
  }, [id, text, reduceMotion]);

  return id ? text.slice(0, typed.id === id ? typed.chars : 0) : "";
}

function toolPart(name: string): UIMessage["parts"][number] {
  return {
    type: `tool-${name}`,
    toolCallId: name,
    state: "output-available",
    input: {},
    output: {},
  };
}

/**
 * The conversation as chat messages: Ollie's lines and his questions in his
 * replies, your answers as your messages, setup steps as his tools.
 */
function toChatMessages(params: {
  lines: AutopilotOnboardingMessage[];
  tools: string[];
  /** The tools come before the line with this id, or at the end. */
  toolsBefore: string;
}) {
  const messages: UIMessage[] = [];
  const say = (id: string, part: UIMessage["parts"][number]) => {
    const last = messages.at(-1);
    if (last?.role === "assistant") {
      last.parts.push(part);
    } else {
      messages.push({ id, role: "assistant", parts: [part] });
    }
  };
  const addTools = () => {
    for (const tool of params.tools) {
      say(tool, toolPart(tool));
    }
  };
  let toolsAdded = false;
  for (const line of params.lines) {
    if (line.id === params.toolsBefore) {
      addTools();
      toolsAdded = true;
    }
    if (line.from === "ollie") {
      say(line.id, { type: "text", text: line.text });
      continue;
    }
    if (line.question.question) {
      say(`${line.id}-question`, {
        type: "text",
        text: line.question.question,
      });
    }
    messages.push({
      id: line.id,
      role: "user",
      parts: [{ type: "text", text: line.answers?.join(", ") ?? "Dismissed" }],
    });
  }
  if (!toolsAdded) {
    addTools();
  }
  return messages;
}

/**
 * Autopilot's first setup as a chat with Ollie, laid out like the agent
 * chat. Once everything is set up the chat fades and the Autopilot page and
 * its agent dock show from under it.
 */
export function AutopilotOnboarding(props: AutopilotOnboardingProps) {
  const { organizationId, organizationSlug, onDone, onReveal } = props;
  const t = useTranslations("dashboard.agent");
  const reduceMotion = useReducedMotion() ?? false;
  const onboarding = useAutopilotOnboarding(props);
  const { phase, setPhase, step, startSetup } = onboarding;
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  const [top, setTop] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const found = document.getElementById(AUTOPILOT_ONBOARDING_LAYER_ID);
    setLayer(found);
    setAutopilotOnboardingActive(true);
    return () => setAutopilotOnboardingActive(false);
  }, []);

  // The chat starts under the page's heading, which stays where it is; the
  // heading is swapped for the dashboard's once Autopilot turns on.
  const enabled = props.overview.settings.enabled;
  useEffect(() => {
    const frame = document.getElementById(
      AUTOPILOT_ONBOARDING_LAYER_ID
    )?.parentElement;
    const measure = () => {
      const anchor = document.querySelector(
        `[${AUTOPILOT_ONBOARDING_ANCHOR_ATTRIBUTE}]`
      );
      if (!(frame && anchor?.isConnected)) {
        setTop((current) => current ?? 0);
        return;
      }
      setTop(
        Math.round(
          anchor.getBoundingClientRect().bottom -
            frame.getBoundingClientRect().top
        )
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (frame) {
      observer.observe(frame);
    }
    return () => observer.disconnect();
  }, [enabled]);

  const finished = phase === "done" || phase === "docking";
  const lines = finished
    ? [...onboarding.messages, onboarding.done]
    : onboarding.messages;
  const typewriter = useOllieTypewriter(
    lines,
    onboarding.ready,
    onboarding.resumed,
    onboarding.thought
  );
  const typed = useTypedText(typewriter.typing, typewriter.finishTyping);

  // Everything answered and said: set up.
  useEffect(() => {
    if (phase === "chat" && step.kind === "setup" && typewriter.done) {
      startSetup();
    }
  }, [phase, step.kind, typewriter.done, startSetup]);

  // "All set" stays a moment, and the chat only fades once the dashboard
  // behind it has loaded, so it never shows half empty.
  const { whenRefreshed } = onboarding;
  useEffect(() => {
    if (phase !== "done" || !typewriter.done) {
      return;
    }
    let cancelled = false;
    const pause = new Promise((resolve) =>
      window.setTimeout(resolve, AUTOPILOT_ONBOARDING_DOCK_DELAY_MS)
    );
    void Promise.all([pause, whenRefreshed()]).then(() => {
      if (!cancelled) {
        setPhase("docking");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [phase, typewriter.done, setPhase, whenRefreshed]);

  // The ending: the dashboard starts rising at once, the real dock shows
  // once Ollie has swum into its spot, then the chat goes.
  useEffect(() => {
    if (phase !== "docking") {
      return;
    }
    onReveal();
    const scale = reduceMotion ? 0 : 1000;
    const dock = window.setTimeout(
      () => setAutopilotOnboardingActive(false),
      ENDING.dockAfter * scale
    );
    const done = window.setTimeout(onDone, ENDING.doneAfter * scale);
    return () => {
      window.clearTimeout(dock);
      window.clearTimeout(done);
    };
  }, [phase, onDone, onReveal, reduceMotion]);

  if (!(layer && onboarding.ready && top !== null)) {
    return null;
  }

  const folding = phase === "docking";
  const question =
    phase === "chat" && typewriter.done && step.kind === "question"
      ? step
      : null;
  const about =
    phase === "chat" && typewriter.done && step.kind === "about" ? step : null;
  // Thinking about your answer: a pause before he replies, or the model
  // reading what you typed.
  const thinking =
    typewriter.thinking ||
    (typewriter.done && step.kind === "waiting" && phase === "chat");
  let mood: OllieMood = "idle";
  if (finished) {
    mood = "happy";
  } else if (typewriter.typing) {
    mood = "talking";
  } else if (thinking) {
    mood = "thinking";
  } else if (phase === "setup") {
    mood = "working";
  }
  const pending = onboarding.pending;

  const tools = [
    ...(step.kind === "connect-github" && typewriter.done && phase === "chat"
      ? [AUTOPILOT_ONBOARDING_TOOLS.connectGitHub]
      : []),
  ];
  const messages = toChatMessages({
    lines: [
      ...typewriter.shown,
      ...(typewriter.typing ? [{ ...typewriter.typing, text: typed }] : []),
      ...(pending && typewriter.done
        ? [
            {
              id: `${pending.id}-answer`,
              from: "you" as const,
              question: pending.question,
              answers: [pending.text],
            },
          ]
        : []),
    ],
    tools,
    toolsBefore: onboarding.done.id,
  });
  const customTools: ChatCustomTools = {
    names: new Set(Object.values(AUTOPILOT_ONBOARDING_TOOLS)),
    render: () => (
      // Sized to their labels, like buttons in a reply.
      <div className="flex flex-wrap gap-2">
        {onboarding.connectGitHub.onRetry ? (
          <Button
            onClick={onboarding.connectGitHub.onRetry}
            size="sm"
            variant="outline"
          >
            Try again
          </Button>
        ) : null}
        <Button
          loading={onboarding.connectGitHub.installing}
          onClick={onboarding.connectGitHub.onConnect}
          size="sm"
          variant="outline"
        >
          <HugeiconsIcon icon={GithubIcon} size={16} />
          Connect GitHub
        </Button>
      </div>
    ),
  };
  let status: "streaming" | "submitted" | "ready" = "ready";
  if (typewriter.typing) {
    status = "streaming";
  } else if (thinking) {
    status = "submitted";
  }

  const ease = { ease: EASE.out };
  const timing = (duration: number, delay = 0) =>
    reduceMotion ? { duration: 0 } : { duration, delay, ...ease };

  // One thing at a time in the input row: a question, the setup, or the
  // input itself. The row morphs from one to the next.
  let footerKey = "input";
  let footer: ReactNode = (
    <ChatInput
      disabled
      organizationId={organizationId}
      organizationSlug={organizationSlug}
      placeholder={t("promptBar.placeholder")}
    />
  );
  if (about) {
    footerKey = "about";
    footer = (
      <AgentQuestionDock
        onDismiss={() => onboarding.skipAbout(about.ids)}
        onSubmit={(answers) => onboarding.answerAbout(answers, about.ids)}
        questions={about.questions}
      />
    );
  } else if (question) {
    footerKey = `question:${question.id}`;
    footer = (
      <AgentQuestionDock
        onDismiss={
          question.skippable ? () => onboarding.skip(question.id) : undefined
        }
        onSubmit={(answers) => onboarding.answer(question.id, answers[0] ?? [])}
        questions={[question.question]}
      />
    );
  } else if (onboarding.tasks.length > 0) {
    footerKey = "setup";
    footer = (
      // At the end the panel sinks away as the chat lifts.
      <m.div
        animate={
          folding
            ? {
                opacity: 0,
                y: 16,
                scale: 0.97,
                filter: `blur(${ENDING.blur}px)`,
              }
            : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
        }
        initial={false}
        transition={timing(ENDING.panelOut)}
      >
        <AutopilotSetupProgress
          finished={finished}
          onRetry={onboarding.retry}
          tasks={onboarding.tasks}
        />
      </m.div>
    );
  }

  return createPortal(
    <LazyMotion features={domAnimation} strict>
      <section
        aria-label="Set up Autopilot"
        className={cn(
          "@container/chat absolute inset-x-0 top-(--onboarding-top) bottom-0 z-20 flex min-w-0 flex-col overflow-hidden",
          folding && "pointer-events-none"
        )}
        ref={sectionRef}
        style={{ "--onboarding-top": `${top}px` } as CSSProperties}
      >
        {/* The page under the chat; it clears a beat after the chat lifts. */}
        <m.div
          animate={{ opacity: folding ? 0 : 1 }}
          aria-hidden="true"
          className="bg-background absolute inset-0"
          initial={false}
          transition={timing(ENDING.backdropOut, ENDING.backdropDelay)}
        />
        <m.div
          animate={
            folding
              ? { opacity: 0, y: -24, filter: `blur(${ENDING.blur + 2}px)` }
              : { opacity: 1, y: 0, filter: "blur(0px)" }
          }
          className="relative flex min-h-0 flex-1 flex-col"
          initial={false}
          transition={timing(ENDING.chatOut)}
        >
          <ChatConversation
            activeChatId="autopilot-onboarding"
            customTools={customTools}
            layout="page"
            messages={messages}
            notices={
              messages.length === 0 ? (
                <p className="text-muted-foreground text-sm motion-safe:animate-pulse">
                  Reading up on your site and what AI says about you…
                </p>
              ) : null
            }
            organizationId={organizationId}
            organizationSlug={organizationSlug}
            status={status}
          />
          {/* Lines scrolling up fade out under the page's heading. */}
          <div
            aria-hidden="true"
            className="from-background pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-linear-to-b to-transparent"
          />
        </m.div>
        {/* Ollie hops along beside the line he's saying, and at the end swims
            down into the agent dock. */}
        <OllieGuide containerRef={sectionRef} diving={folding} mood={mood} />
        {/* The agent chat's input row: questions, then the setup's progress. */}
        <div className="relative z-10 px-4 pb-4">
          <div className="mx-auto w-full max-w-2xl min-w-0">
            <AutopilotFooterSwap swapKey={footerKey}>
              {footer}
            </AutopilotFooterSwap>
          </div>
        </div>
      </section>
    </LazyMotion>,
    layer
  );
}
