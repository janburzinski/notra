"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import {
  AUTOPILOT_ONBOARDING_PAUSE_MS,
  AUTOPILOT_ONBOARDING_THINK_MS,
} from "@/constants/autopilot-onboarding";
import type { AutopilotOnboardingMessage } from "@/types/autopilot-onboarding";
import { randomBetween } from "@/utils/autopilot-onboarding";

/**
 * Which lines of the conversation are on screen. Your answers show at once.
 * Before answering you Ollie thinks a moment, and between his own lines he
 * pauses, each for a random while; then the line types itself and calls
 * `finishTyping`. A conversation picked up after a redirect shows in full.
 */
export function useOllieTypewriter(
  messages: AutopilotOnboardingMessage[],
  ready: boolean,
  resumed: boolean,
  /** Lines the model already took its time over: no extra thinking. */
  thought: ReadonlySet<string>
) {
  const reduceMotion = useReducedMotion() ?? false;
  const [count, setCount] = useState<number | null>(null);
  const [started, setStarted] = useState<string | null>(null);
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (ready && count === null) {
      setCount(resumed ? messages.length : 0);
    }
  }, [ready, resumed, count, messages.length]);

  const message = count === null ? undefined : messages[count];
  const previous = count ? messages[count - 1] : undefined;
  // Each of your answers shows at once, also several in a row.
  const yourLine = message?.from === "you" ? message.id : null;
  useEffect(() => {
    if (yourLine) {
      setCount((current) =>
        current !== null && messagesRef.current[current]?.id === yourLine
          ? current + 1
          : current
      );
    }
  }, [yourLine]);

  // Ollie's next line waits a beat before he starts on it.
  const waitingFor =
    message?.from === "ollie" && started !== message.id ? message.id : null;
  const answering =
    waitingFor !== null &&
    previous?.from !== "ollie" &&
    !thought.has(waitingFor);
  useEffect(() => {
    if (!waitingFor) {
      return;
    }
    const range = answering
      ? AUTOPILOT_ONBOARDING_THINK_MS
      : AUTOPILOT_ONBOARDING_PAUSE_MS;
    const id = window.setTimeout(
      () => setStarted(waitingFor),
      reduceMotion ? 0 : randomBetween(range)
    );
    return () => window.clearTimeout(id);
  }, [waitingFor, answering, reduceMotion]);

  /** Moves on from the line with this id; a second call for it does nothing. */
  const finishTyping = (id: string) =>
    setCount((current) =>
      current !== null && messagesRef.current[current]?.id === id
        ? current + 1
        : current
    );

  const shown = count ?? 0;
  return {
    shown: messages.slice(0, shown),
    typing:
      message?.from === "ollie" && started === message.id ? message : null,
    /** Ollie is thinking about what you said. */
    thinking: answering,
    finishTyping,
    done: count !== null && shown >= messages.length,
  };
}
