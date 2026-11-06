"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  GEMINI_SEARCHING_LABEL,
  GEMINI_THINKING_LABEL,
} from "../constants/gemini";
import type { GeminiPlaybackPhase, GeminiStoryMessage } from "../types/gemini";

const TOKEN_SPLIT = /(\s+)/;
const REDUCED_MOTION_MAX_DELAY_MS = 70;
const USER_TURN_DELAY_MS = 420;
const SEARCH_DELAY_MS = 1800;
const THINK_DELAY_MS = 1100;
const REDUCED_REPLY_DELAY_MS = 180;
const TOKEN_DELAY_MS = 28;
const TURN_END_DELAY_MS = 480;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const useGeminiPlayback = (
  script: readonly GeminiStoryMessage[],
  reducedMotion: boolean
) => {
  const [messages, setMessages] = useState<GeminiStoryMessage[]>(() => [
    ...script,
  ]);
  const [completeIds, setCompleteIds] = useState<ReadonlySet<string>>(
    () => new Set(script.map((item) => item.id))
  );
  const [phase, setPhase] = useState<GeminiPlaybackPhase>({ status: "idle" });
  const phaseRef = useRef(phase);
  const enter = useCallback((next: GeminiPlaybackPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const setThinking = useCallback(
    (thinking: boolean) => {
      const current = phaseRef.current;
      if (current.status === "playing") {
        enter({ ...current, thinking });
      }
    },
    [enter]
  );
  const [thinkingLabel, setThinkingLabel] = useState(GEMINI_SEARCHING_LABEL);
  const runRef = useRef(0);

  const markComplete = useCallback((id: string) => {
    setCompleteIds((current) => new Set(current).add(id));
  }, []);

  const resetToScript = useCallback(() => {
    setMessages([...script]);
    setCompleteIds(new Set(script.map((item) => item.id)));
    setThinkingLabel(GEMINI_SEARCHING_LABEL);
    enter({ status: "idle" });
  }, [enter, script]);

  const stop = useCallback(() => {
    runRef.current += 1;
    resetToScript();
  }, [resetToScript]);

  const playTurn = useCallback(
    async (message: GeminiStoryMessage, alive: () => boolean) => {
      const delay = (ms: number) =>
        wait(reducedMotion ? Math.min(ms, REDUCED_MOTION_MAX_DELAY_MS) : ms);

      if (message.from === "user") {
        setMessages((current) => [...current, message]);
        markComplete(message.id);
        await delay(USER_TURN_DELAY_MS);
        return;
      }

      setThinkingLabel(
        message.search ? GEMINI_SEARCHING_LABEL : GEMINI_THINKING_LABEL
      );
      setThinking(true);
      await delay(message.search ? SEARCH_DELAY_MS : THINK_DELAY_MS);
      if (!alive()) {
        return;
      }
      setThinking(false);

      if (reducedMotion) {
        setMessages((current) => [...current, message]);
        markComplete(message.id);
        await delay(REDUCED_REPLY_DELAY_MS);
        return;
      }

      setMessages((current) => [...current, { ...message, text: "" }]);
      let text = "";
      for (const token of message.text.split(TOKEN_SPLIT)) {
        if (!alive()) {
          return;
        }
        text += token;
        const snapshot = text;
        setMessages((current) =>
          current.map((item) =>
            item.id === message.id ? { ...item, text: snapshot } : item
          )
        );
        await delay(TOKEN_DELAY_MS);
      }
      if (!alive()) {
        return;
      }
      markComplete(message.id);
      await delay(TURN_END_DELAY_MS);
    },
    [markComplete, reducedMotion, setThinking]
  );

  const play = useCallback(async () => {
    const run = runRef.current + 1;
    runRef.current = run;
    const alive = () => runRef.current === run;

    enter({ status: "playing", source: "script", thinking: false });
    setMessages([]);
    setCompleteIds(new Set());

    for (const message of script) {
      if (!alive()) {
        return;
      }
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- turns must play one after another
      await playTurn(message, alive);
    }

    if (alive()) {
      enter({ status: "idle" });
    }
  }, [enter, playTurn, script]);

  const send = useCallback(
    async (text: string, reply: string) => {
      const current = phaseRef.current;
      if (current.status === "playing" && current.source === "send") {
        return;
      }
      const run = runRef.current + 1;
      runRef.current = run;
      const alive = () => runRef.current === run;
      const now = Date.now();

      enter({ status: "playing", source: "send", thinking: false });
      await playTurn({ from: "user", id: `user-${now}`, text }, alive);
      if (!alive()) {
        return;
      }
      await playTurn(
        { from: "assistant", id: `assistant-${now}`, text: reply },
        alive
      );
      if (alive()) {
        enter({ status: "idle" });
      }
    },
    [enter, playTurn]
  );

  useEffect(
    () => () => {
      runRef.current += 1;
    },
    []
  );

  const playing = phase.status === "playing";
  const thinking = phase.status === "playing" && phase.thinking;

  return {
    completeIds,
    messages,
    play,
    playing,
    send,
    stop,
    thinking,
    thinkingLabel,
  };
};
