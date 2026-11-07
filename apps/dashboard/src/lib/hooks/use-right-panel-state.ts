"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { usePathname } from "@/lib/navigation";
import type {
  AgentDraftTarget,
  AgentPanelPrompt,
  AgentPromptOptions,
  RightPanelContextValue,
  RightPanelId,
} from "@/types/components/right-panel";

const INITIAL_HAS_OPENED: Record<RightPanelId, boolean> = {
  agent: false,
  content: false,
  preview: false,
};

export function useRightPanelState(): RightPanelContextValue {
  const pathname = usePathname();
  const [active, setActive] = useState<RightPanelId | null>(null);
  const [expandRequested, setExpandRequested] = useState(false);
  const [seenPathname, setSeenPathname] = useState(pathname);
  const [hasOpened, setHasOpened] = useState(INITIAL_HAS_OPENED);
  const [agentPrompt, setAgentPrompt] = useState<AgentPanelPrompt | null>(null);
  // The composers showing, newest last. A draft goes to the newest one, or
  // waits for the next to show.
  const draftTargetsRef = useRef<AgentDraftTarget[]>([]);
  // A draft waits only for a composer on the page it was made on.
  const pendingDraftRef = useRef<{ text: string; pathname: string } | null>(
    null
  );

  if (seenPathname !== pathname) {
    setSeenPathname(pathname);
    if (expandRequested) {
      setExpandRequested(false);
    }
  }

  if (active === null && expandRequested) {
    setExpandRequested(false);
  }

  const expanded = active !== null && expandRequested;

  const openPanel = (id: RightPanelId) => {
    setActive(id);
    setHasOpened((current) =>
      current[id] ? current : { ...current, [id]: true }
    );
  };

  const closePanel = (id?: RightPanelId) => {
    setActive((current) => {
      if (id && current !== id) {
        return current;
      }
      return null;
    });
  };

  const togglePanel = (id: RightPanelId) => {
    setActive((current) => (current === id ? null : id));
    setHasOpened((opened) => (opened[id] ? opened : { ...opened, [id]: true }));
  };

  const askAgent = (text: string, options?: AgentPromptOptions) => {
    setAgentPrompt({ id: Date.now(), text, ...options });
    openPanel("agent");
  };

  const takeAgentPrompt = (id: number) => {
    setAgentPrompt((current) => (current?.id === id ? null : current));
  };

  const draftAgentPrompt = (text: string) => {
    const target = draftTargetsRef.current.at(-1);
    if (target) {
      target(text);
      return;
    }
    pendingDraftRef.current = { text, pathname: window.location.pathname };
  };

  const registerAgentDraftTarget = useCallback((target: AgentDraftTarget) => {
    draftTargetsRef.current = [...draftTargetsRef.current, target];
    const pending = pendingDraftRef.current;
    pendingDraftRef.current = null;
    if (pending?.pathname === window.location.pathname) {
      target(pending.text);
    }
    return () => {
      draftTargetsRef.current = draftTargetsRef.current.filter(
        (item) => item !== target
      );
    };
  }, []);

  const toggleExpanded = () => {
    if (active === null) {
      return;
    }
    setExpandRequested((current) => !current);
  };

  useEffect(() => {
    if (!expanded) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }
      event.preventDefault();
      setExpandRequested(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  return {
    active,
    expanded,
    hasOpened,
    openPanel,
    closePanel,
    togglePanel,
    toggleExpanded,
    agentPrompt,
    askAgent,
    takeAgentPrompt,
    draftAgentPrompt,
    registerAgentDraftTarget,
  };
}
