"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { AGENT_QUESTION_DOCK_ATTRIBUTE } from "@/constants/agent-questions";
import { usePathname } from "@/lib/navigation";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { UseAutopilotDockKeysOptions } from "@/types/hooks/agent-panel";
import {
  autopilotAutomationKindFromPath,
  autopilotWorkflowIdFromPath,
} from "@/utils/autopilot-workflows";

/**
 * What the dock's conversation is about: the workflow or built-in automation
 * on screen. Taken off, it stays off until the next page, which brings its own.
 */
export function useAutopilotDockFocus(
  organizationId: string,
  onNavigate: () => void
) {
  const pathname = usePathname();
  const [shownPathname, setShownPathname] = useState(pathname);
  const [detached, setDetached] = useState(false);
  if (pathname !== shownPathname) {
    setShownPathname(pathname);
    setDetached(false);
    onNavigate();
  }
  const focusWorkflowId = detached
    ? null
    : autopilotWorkflowIdFromPath(pathname);
  const focusAutomation = detached
    ? null
    : autopilotAutomationKindFromPath(pathname);
  const { data: focusWorkflow } = useQuery(
    dashboardOrpc.autopilot.workflows.get.queryOptions({
      input: { organizationId, workflowId: focusWorkflowId ?? "" },
      enabled: focusWorkflowId !== null,
    })
  );
  return {
    focusWorkflowId,
    focusAutomation,
    focusWorkflow,
    detach: () => setDetached(true),
  };
}

/**
 * Escape steps the dock back one size. Reaching the input of a conversation
 * that is already going, by keyboard or pointer, brings it back. Returns the
 * flag that keeps it folded while minimizing hands focus to the input.
 */
export function useAutopilotDockKeys({
  dockRef,
  mode,
  setMode,
  hasMessages,
}: UseAutopilotDockKeysOptions) {
  const keepCollapsedRef = useRef(false);
  useEffect(() => {
    const element = dockRef.current;
    if (!element) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        // The questions use Escape to dismiss; it is theirs, not the dock's.
        (event.target instanceof Element &&
          event.target.closest(`[${AGENT_QUESTION_DOCK_ATTRIBUTE}]`))
      ) {
        return;
      }
      if (mode === "fullscreen") {
        setMode("open");
      } else if (mode === "open") {
        setMode("collapsed");
      }
    };
    const reopen = () => {
      if (keepCollapsedRef.current) {
        keepCollapsedRef.current = false;
        return;
      }
      if (mode === "collapsed" && hasMessages) {
        setMode("open");
      }
    };
    element.addEventListener("keydown", onKeyDown);
    element.addEventListener("focusin", reopen);
    element.addEventListener("pointerdown", reopen);
    return () => {
      element.removeEventListener("keydown", onKeyDown);
      element.removeEventListener("focusin", reopen);
      element.removeEventListener("pointerdown", reopen);
    };
  }, [dockRef, hasMessages, mode, setMode]);
  return keepCollapsedRef;
}
