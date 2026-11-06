"use client";

import {
  ArrowLeft01Icon,
  ArrowReloadHorizontalIcon,
  ArrowRight01Icon,
  Edit02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { CopyStateIcon } from "@notra/ui/components/ui/copy-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { useCopyToClipboard } from "@notra/ui/hooks/use-copy-to-clipboard";
import { TRANSITION } from "@notra/ui/lib/motion";
import { cn } from "@notra/ui/lib/utils";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import type {
  UserMessageEditorProps,
  UserMessageTextBubbleProps,
} from "@/types/components/chat-page";

const USER_MESSAGE_COPIED_MS = 1500;

interface UserMessageActionsProps {
  messageText: string;
  canInteract: boolean;
  onEdit: () => void;
  onRetry: () => void;
  branchIndex?: number;
  branchTotal?: number;
  onPreviousBranch?: () => void;
  onNextBranch?: () => void;
  isEditing?: boolean;
  className?: string;
}

export function UserMessageActions({
  messageText,
  canInteract,
  onEdit,
  onRetry,
  branchIndex,
  branchTotal,
  onPreviousBranch,
  onNextBranch,
  isEditing,
  className,
}: UserMessageActionsProps) {
  const t = useTranslations("chat.userMessageActions");
  const tCommon = useTranslations("common.actions");
  const { copied, copy } = useCopyToClipboard({
    timeout: USER_MESSAGE_COPIED_MS,
  });

  const hasBranches =
    typeof branchIndex === "number" &&
    typeof branchTotal === "number" &&
    branchTotal > 1;

  return (
    <div
      className={cn(
        "text-muted-foreground duration-fast absolute top-full right-0 flex items-center gap-1 pt-1 transition-opacity",
        isEditing
          ? "pointer-events-none invisible opacity-0"
          : "pointer-events-none opacity-0 group-hover/message:pointer-events-auto group-hover/message:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100",
        className
      )}
    >
      {hasBranches && (
        <div className="flex items-center text-xs tabular-nums">
          <Button
            aria-label={t("previousVersion")}
            className="size-5"
            disabled={!canInteract}
            onClick={onPreviousBranch}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={12} />
          </Button>
          <span className="px-0.5 text-[11px]">
            {(branchIndex ?? 0) + 1}/{branchTotal}
          </span>
          <Button
            aria-label={t("nextVersion")}
            className="size-5"
            disabled={!canInteract}
            onClick={onNextBranch}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} size={12} />
          </Button>
        </div>
      )}

      <TooltipProvider>
        <div className="flex items-center gap-1">
          <Tooltip disableHoverablePopup>
            <TooltipTrigger
              render={
                <Button
                  aria-label={tCommon("retry")}
                  className="size-5"
                  disabled={!canInteract}
                  onClick={onRetry}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                />
              }
            >
              <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={12} />
            </TooltipTrigger>
            <TooltipContent>{tCommon("retry")}</TooltipContent>
          </Tooltip>

          <Tooltip disableHoverablePopup>
            <TooltipTrigger
              render={
                <Button
                  aria-label={t("editMessage")}
                  className="size-5"
                  disabled={!canInteract}
                  onClick={onEdit}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                />
              }
            >
              <HugeiconsIcon icon={Edit02Icon} size={12} />
            </TooltipTrigger>
            <TooltipContent>{tCommon("edit")}</TooltipContent>
          </Tooltip>

          <Tooltip disableHoverablePopup>
            <TooltipTrigger
              render={
                <Button
                  aria-label={t("copyMessage")}
                  className="size-5"
                  onClick={() => copy(messageText)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                />
              }
            >
              <CopyStateIcon copied={copied} iconClassName="size-3" />
            </TooltipTrigger>
            <TooltipContent>
              {copied ? tCommon("copied") : tCommon("copy")}
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}

const USER_MESSAGE_BUBBLE_CLASS =
  "ml-auto flex min-w-0 flex-col gap-2 overflow-hidden rounded-lg bg-secondary px-4 py-3 text-foreground text-sm";

const USER_MESSAGE_EDIT_TRANSITION = TRANSITION.enter;
const USER_MESSAGE_FADE_TRANSITION = TRANSITION.fade;

function UserMessageEditor({
  initialText,
  onCancel,
  onSubmit,
}: UserMessageEditorProps) {
  const t = useTranslations("chat.userMessageActions");
  const tCommon2 = useTranslations("common");
  const tCommon = useTranslations("common.actions");
  const [value, setValue] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const reduceMotion = useReducedMotion();

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when value changes (scrollHeight is read from the DOM).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const trimmedValue = value.trim();
  const isUnchanged = trimmedValue === initialText.trim();

  const handleSubmit = () => {
    if (!trimmedValue) {
      return;
    }
    if (isUnchanged) {
      onCancel();
      return;
    }
    onSubmit(trimmedValue);
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="text-foreground placeholder:text-muted-foreground max-h-80 min-h-6 w-full resize-none bg-transparent text-sm leading-6 wrap-break-word outline-none"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) {
            return;
          }
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder={t("editPlaceholder")}
        ref={textareaRef}
        rows={1}
        value={value}
      />
      <m.div
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-end gap-2"
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        transition={USER_MESSAGE_FADE_TRANSITION}
      >
        <Button onClick={onCancel} size="sm" type="button" variant="ghost">
          {tCommon("cancel")}
        </Button>
        <Button
          disabled={trimmedValue.length === 0 || isUnchanged}
          onClick={handleSubmit}
          size="sm"
          type="button"
        >
          {tCommon2("labels.send")}
        </Button>
      </m.div>
    </div>
  );
}

export function UserMessageTextBubble({
  children,
  isEditing,
  initialText,
  onCancel,
  onSubmit,
}: UserMessageTextBubbleProps) {
  const reduceMotion = useReducedMotion();

  return (
    <m.div
      className={cn(
        USER_MESSAGE_BUBBLE_CLASS,
        isEditing ? "w-full" : "is-user:dark w-fit max-w-full"
      )}
      layout={!reduceMotion}
      transition={USER_MESSAGE_EDIT_TRANSITION}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {isEditing ? (
          <m.div
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            initial={reduceMotion ? false : { opacity: 0 }}
            key="edit"
            transition={USER_MESSAGE_FADE_TRANSITION}
          >
            <UserMessageEditor
              initialText={initialText}
              onCancel={onCancel}
              onSubmit={onSubmit}
            />
          </m.div>
        ) : (
          <m.div
            animate={{ opacity: 1 }}
            className="flex min-w-0 flex-col gap-2 overflow-hidden"
            exit={reduceMotion ? undefined : { opacity: 0 }}
            initial={reduceMotion ? false : { opacity: 0 }}
            key="view"
            transition={USER_MESSAGE_FADE_TRANSITION}
          >
            {children}
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}
