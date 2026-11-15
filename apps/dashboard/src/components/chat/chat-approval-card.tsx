"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@notra/ui/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
} from "@notra/ui/components/ui/collapsible";
import { Kbd } from "@notra/ui/components/ui/kbd";
import { cn } from "@notra/ui/lib/utils";
import { getToolName } from "ai";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { AnswerMark } from "@/components/ai/answer-mark";
import {
  getToolApprovalTitle,
  JsonView,
} from "@/components/ai/chat-tool-block";
import {
  CHAT_APPROVAL_ROW_CLASS,
  CHAT_APPROVAL_ROW_IDLE_CLASS,
  CHAT_APPROVAL_ROW_PICKED_CLASS,
} from "@/constants/chat-approval";
import type {
  ChatApprovalCardProps,
  ChatApprovalChoice,
} from "@/types/chat-approval";
import { getApprovalInputChips } from "@/utils/chat-tool-approval";
import { getChatToolIcon } from "@/utils/chat-tool-icon";

/**
 * The input chips and the full input trade places: each folds its height
 * while fading, so the card grows and shrinks instead of jumping.
 */
const INPUT_PANEL_CLASSNAME =
  "h-[var(--collapsible-panel-height)] overflow-hidden outline-none transition-[height,opacity] duration-normal ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none";

const CHOICES: ChatApprovalChoice[] = ["once", "chat", "reply"];

/**
 * A tool call waiting on you, in place of the chat input, laid out like the
 * agent's questions: what it will do, its input as chips (the JSON on
 * request), and the answers as rows. A row only picks its answer; the button
 * or Enter confirms it, like the agent's questions. The last row is your own
 * words, which deny the call and send what you wrote instead.
 */
export function ChatApprovalCard({ approval, onReply }: ChatApprovalCardProps) {
  const t = useTranslations("chat.approval");
  const tTool = useTranslations("ai.toolBlock");
  const titleId = useId();
  const [showInput, setShowInput] = useState(false);
  const [choice, setChoice] = useState<ChatApprovalChoice>("once");
  const [reply, setReply] = useState("");
  const sectionRef = useRef<HTMLElement | null>(null);
  const rowsRef = useRef<(HTMLElement | null)[]>([]);
  const replyRef = useRef<HTMLInputElement | null>(null);
  const { part } = approval;
  const toolName = getToolName(part);
  const toolMetadata =
    part.type === "dynamic-tool" ? part.toolMetadata : undefined;
  const chips = getApprovalInputChips(part.input);
  const hasInput = part.input != null;
  const replyText = reply.trim();

  const confirm = () => {
    if (choice === "once") {
      approval.onAllowOnce();
    } else if (choice === "chat") {
      approval.onAllowForChat();
    } else if (replyText && onReply(replyText)) {
      setReply("");
    }
  };

  const pick = (next: ChatApprovalChoice) => {
    setChoice(next);
    if (next === "reply") {
      // A frame later: focused inside the 3 keypress, the field gets the
      // caret but none of the typing that follows.
      window.requestAnimationFrame(() => replyRef.current?.focus());
    }
  };

  // It takes the keyboard from the input it replaces, but never from
  // something else the user is typing in.
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body || active.closest("[hidden]")) {
      sectionRef.current?.focus({ preventScroll: true });
    }
  }, []);

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.isComposing || event.repeat) {
      return;
    }
    const typing = event.target === replyRef.current;
    if (event.key === "Escape") {
      event.preventDefault();
      // A surrounding dialog would close on the same Escape otherwise.
      event.stopPropagation();
      if (typing && replyText) {
        sectionRef.current?.focus({ preventScroll: true });
        return;
      }
      approval.onDeny();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      // Rows only pick, so Enter on a focused row confirms instead of
      // clicking it. Other buttons, like Deny, keep their own Enter.
      const target = event.target;
      const answers =
        target === sectionRef.current ||
        target === replyRef.current ||
        rowsRef.current.includes(target as HTMLElement);
      if (!answers) {
        return;
      }
      event.preventDefault();
      confirm();
      return;
    }
    if (typing || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    if (/^[1-3]$/.test(event.key)) {
      event.preventDefault();
      const index = Number(event.key) - 1;
      pick(CHOICES[index] ?? "once");
      if (index < CHOICES.length - 1) {
        rowsRef.current[index]?.focus();
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const at = rowsRef.current.indexOf(document.activeElement as HTMLElement);
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = Math.max(0, Math.min(CHOICES.length - 1, at + step));
      pick(CHOICES[next] ?? "once");
      rowsRef.current[next]?.focus();
    }
  });

  useEffect(() => {
    const element = sectionRef.current;
    if (!element) {
      return;
    }
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    element.addEventListener("keydown", listener);
    return () => element.removeEventListener("keydown", listener);
  }, []);

  let confirmLabel = t("allowOnce");
  if (choice === "chat") {
    confirmLabel = t("allowForChat");
  } else if (choice === "reply") {
    confirmLabel = t("send");
  }

  return (
    <section
      aria-labelledby={titleId}
      className="duration-normal flex flex-col opacity-100 transition-opacity ease-out outline-none motion-reduce:transition-none starting:opacity-0"
      ref={sectionRef}
      tabIndex={-1}
    >
      <div className="flex min-w-0 flex-col px-4 pt-3.5 pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <HugeiconsIcon
            aria-hidden="true"
            className="text-muted-foreground size-4 shrink-0"
            icon={getChatToolIcon(toolName)}
            strokeWidth={1.8}
          />
          <p
            className="min-w-0 flex-1 truncate text-sm font-medium"
            id={titleId}
          >
            {getToolApprovalTitle({
              toolName,
              input: part.input,
              toolMetadata,
              t: tTool,
            })}
          </p>
          {hasInput ? (
            <Button
              aria-expanded={showInput}
              className="-my-1 -mr-2 active:scale-100"
              onClick={() => setShowInput((open) => !open)}
              size="xs"
              variant="ghost"
            >
              {showInput ? t("hideInput") : t("showInput")}
              <HugeiconsIcon
                aria-hidden="true"
                className={cn(
                  "duration-fast size-3 transition-transform ease-out motion-reduce:transition-none",
                  showInput && "rotate-180"
                )}
                icon={ArrowDown01Icon}
              />
            </Button>
          ) : null}
        </div>
        {/* Spacing sits inside each panel, so nothing jumps as one unmounts. */}
        {chips.length > 0 ? (
          <Collapsible open={!showInput}>
            <CollapsibleContent className={INPUT_PANEL_CLASSNAME}>
              <ul className="flex flex-wrap gap-1.5 pt-2 pl-6.5">
                {chips.map((chip) => (
                  <li
                    className="bg-muted flex max-w-full min-w-0 items-baseline gap-1.5 rounded-md px-2 py-0.5 text-xs"
                    key={chip.key}
                  >
                    <span className="text-muted-foreground shrink-0">
                      {chip.label}
                    </span>
                    <span className="truncate">{chip.value}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
        {hasInput ? (
          <Collapsible open={showInput}>
            <CollapsibleContent className={INPUT_PANEL_CLASSNAME}>
              <div className="pt-2">
                <div className="max-h-56 overflow-y-auto">
                  <JsonView value={part.input} />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </div>

      <div
        aria-labelledby={titleId}
        className="flex flex-col gap-1.5 px-3"
        role="radiogroup"
      >
        {(["once", "chat"] as const).map((value, index) => (
          <button
            aria-checked={choice === value}
            aria-keyshortcuts={String(index + 1)}
            className={cn(
              CHAT_APPROVAL_ROW_CLASS,
              choice === value
                ? CHAT_APPROVAL_ROW_PICKED_CLASS
                : CHAT_APPROVAL_ROW_IDLE_CLASS
            )}
            key={value}
            onClick={() => pick(value)}
            ref={(element) => {
              rowsRef.current[index] = element;
            }}
            role="radio"
            type="button"
          >
            <AnswerMark
              className="rounded-md"
              number={index + 1}
              picked={choice === value}
            />
            <span className="min-w-0 flex-1 text-sm">
              {value === "once" ? t("allowOnce") : t("allowForChat")}
            </span>
          </button>
        ))}
        {/* There is always a way to answer in your own words. */}
        <div
          className={cn(
            CHAT_APPROVAL_ROW_CLASS,
            "py-1.5",
            choice === "reply"
              ? CHAT_APPROVAL_ROW_PICKED_CLASS
              : CHAT_APPROVAL_ROW_IDLE_CLASS
          )}
        >
          <button
            aria-checked={choice === "reply"}
            aria-keyshortcuts="3"
            aria-label={t("replyPlaceholder")}
            className="focus-visible:ring-ring/50 -my-1 flex shrink-0 rounded-md py-1 outline-none focus-visible:ring-2"
            onClick={() => pick("reply")}
            ref={(element) => {
              rowsRef.current[2] = element;
            }}
            role="radio"
            type="button"
          >
            <AnswerMark
              className="rounded-md"
              number={3}
              picked={choice === "reply"}
            />
          </button>
          <input
            aria-label={t("replyPlaceholder")}
            className="placeholder:text-muted-foreground h-7 min-w-0 flex-1 bg-transparent text-sm outline-none"
            onChange={(event) => {
              setReply(event.target.value);
              setChoice("reply");
            }}
            onFocus={() => setChoice("reply")}
            placeholder={t("replyPlaceholder")}
            ref={replyRef}
            value={reply}
          />
        </div>
      </div>

      <footer className="flex items-center justify-between gap-2 px-3 py-3">
        <Button
          aria-keyshortcuts="Escape"
          onClick={approval.onDeny}
          size="sm"
          variant="ghost"
        >
          {t("deny")}
          <Kbd>Esc</Kbd>
        </Button>
        <Button
          aria-keyshortcuts="Enter"
          disabled={choice === "reply" && !replyText}
          onClick={confirm}
          size="sm"
        >
          {confirmLabel}
          <span aria-hidden="true" className="text-xs opacity-60">
            ↵
          </span>
        </Button>
      </footer>
    </section>
  );
}
