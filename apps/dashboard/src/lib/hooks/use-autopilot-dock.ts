"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { AGENT_QUESTION_DOCK_ATTRIBUTE } from "@/constants/agent-questions";
import { usePathname } from "@/lib/navigation";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  UseAutopilotDockActivityOptions,
  UseAutopilotDockKeysOptions,
} from "@/types/hooks/agent-panel";
import {
  autopilotDockActivity,
  latestReply,
} from "@/utils/autopilot-dock-activity";
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
 * that is already going, by keyboard or pointer, brings it back; its buttons,
 * such as "+", don't. Returns the flag that keeps it folded while minimizing
 * hands focus to the input.
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
    // Open, Escape folds the dock wherever focus is, like the agent panel,
    // unless something it opened or a popup on top claims the key first.
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        mode === "collapsed" ||
        event.key !== "Escape" ||
        event.defaultPrevented ||
        // Hidden on this page, there's nothing to fold.
        element.getClientRects().length === 0 ||
        // The questions use Escape to dismiss; it is theirs, not the dock's.
        // Dialogs, menus and pickers close themselves first.
        (event.target instanceof Element &&
          event.target.closest(
            `[${AGENT_QUESTION_DOCK_ATTRIBUTE}], [role='dialog'], [role='alertdialog'], [role='menu'], [role='listbox']`
          ))
      ) {
        return;
      }
      event.preventDefault();
      setMode(mode === "fullscreen" ? "open" : "collapsed");
    };
    const reopen = (event: Event) => {
      if (
        event.target instanceof Element &&
        event.target.closest("button, [role='button']")
      ) {
        return;
      }
      if (keepCollapsedRef.current) {
        keepCollapsedRef.current = false;
        return;
      }
      if (mode === "collapsed" && hasMessages) {
        setMode("open");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    element.addEventListener("focusin", reopen);
    element.addEventListener("pointerdown", reopen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      element.removeEventListener("focusin", reopen);
      element.removeEventListener("pointerdown", reopen);
    };
  }, [dockRef, hasMessages, mode, setMode]);
  return keepCollapsedRef;
}

/**
 * Holds the open dock's shell from the moment it opens until the conversation
 * has folded away again, so the page never shows through while it grows or
 * folds. Call `release` once the fold has finished.
 */
export function useDockShell(expanded: boolean) {
  const [held, setHeld] = useState(false);
  if (expanded && !held) {
    setHeld(true);
  }
  return { shelled: expanded || held, release: () => setHeld(false) };
}

/**
 * The line the folded dock keeps above its input. A reply that lands while
 * it's folded stays flagged until the dock opens, so it doesn't vanish with
 * the spinner. Only a reply that arrived during the request counts: stopping
 * one before it answers doesn't mark the previous answer as new.
 */
export function useAutopilotDockActivity({
  messages,
  busy,
  expanded,
  failed,
}: UseAutopilotDockActivityOptions) {
  const reply = latestReply(messages);
  const [wasBusy, setWasBusy] = useState(busy);
  const [replyBefore, setReplyBefore] = useState(reply.signature);
  const [unseenReplyId, setUnseenReplyId] = useState<string | null>(null);
  if (busy !== wasBusy) {
    setWasBusy(busy);
    if (busy) {
      setReplyBefore(reply.signature);
      setUnseenReplyId(null);
    } else if (!(expanded || failed) && reply.signature !== replyBefore) {
      setUnseenReplyId(reply.id);
    }
  }
  if (expanded && unseenReplyId) {
    setUnseenReplyId(null);
  }
  return expanded
    ? null
    : autopilotDockActivity({ messages, busy, unseenReplyId });
}
