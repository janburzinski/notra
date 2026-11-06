"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { claudeSearchDuration, claudeWait } from "../lib/claude-search";
import type { ClaudeDemoMessage, ClaudePlaybackPhase } from "../types/claude";

const TOKEN_SPLIT = /(\s+)/;

const USER_TURN_MS = 420;
const THINKING_MS = 1200;
const SETTLE_MS = 180;
const TOKEN_MS = 28;
const TURN_GAP_MS = 480;
const REDUCED_MAX_MS = 70;

const idsOf = (script: readonly ClaudeDemoMessage[]) =>
  new Set(script.map((item) => item.id));

export const useClaudePlayback = (
  script: readonly ClaudeDemoMessage[],
  reducedMotion: boolean
) => {
  const [messages, setMessages] = useState<ClaudeDemoMessage[]>(() => [
    ...script,
  ]);
  const [completeIds, setCompleteIds] = useState(() => idsOf(script));
  const [phase, setPhase] = useState<ClaudePlaybackPhase>({ status: "idle" });
  const phaseRef = useRef(phase);
  const enter = useCallback((next: ClaudePlaybackPhase) => {
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
  const runRef = useRef(0);

  const markComplete = useCallback((id: string) => {
    setCompleteIds((current) => new Set(current).add(id));
  }, []);

  const stop = useCallback(() => {
    runRef.current += 1;
    setMessages([...script]);
    setCompleteIds(idsOf(script));
    enter({ status: "idle" });
  }, [enter, script]);

  const playTurn = useCallback(
    async (message: ClaudeDemoMessage, alive: () => boolean) => {
      const delay = (ms: number) =>
        claudeWait(reducedMotion ? Math.min(ms, REDUCED_MAX_MS) : ms);

      if (message.from === "user") {
        setMessages((current) => [...current, message]);
        markComplete(message.id);
        await delay(USER_TURN_MS);
        return;
      }

      if (reducedMotion) {
        if (!message.search) {
          setThinking(true);
          await delay(THINKING_MS);
          if (!alive()) {
            return;
          }
          setThinking(false);
        }
        setMessages((current) => [...current, message]);
        markComplete(message.id);
        await delay(SETTLE_MS);
        return;
      }

      if (message.search) {
        setThinking(false);
        setMessages((current) => [...current, { ...message, text: "" }]);
        await delay(
          claudeSearchDuration(message.search, reducedMotion) + SETTLE_MS
        );
      } else {
        setThinking(true);
        await delay(THINKING_MS);
        if (!alive()) {
          return;
        }
        setThinking(false);
        setMessages((current) => [...current, { ...message, text: "" }]);
      }

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
        await delay(TOKEN_MS);
      }
      markComplete(message.id);
      await delay(TURN_GAP_MS);
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

  return { completeIds, messages, play, playing, send, stop, thinking };
};
