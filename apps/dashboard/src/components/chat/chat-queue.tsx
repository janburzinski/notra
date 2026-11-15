"use client";

import { Attachment01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type {
  ChatAttachment,
  ContextItem,
  TextSelection,
} from "@notra/ai/types/chat";
import { Composer } from "@notra/ui/components/ui/composer";
import { TRANSITION } from "@notra/ui/lib/motion";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useTranslations } from "use-intl";

import { MessageAuthorAvatar } from "@/components/chat/message-author-avatar";
import {
  COMPOSER_QUEUED_CHIP,
  COMPOSER_QUEUED_CHIP_LABEL,
} from "@/constants/composer";
import type { ChatMessageAuthor } from "@/types/chat";
import { unknownChatMessageAuthor } from "@/utils/chat-message-author";

export interface QueuedMessage {
  id: string;
  text: string;
  authorUserId?: string;
  selection?: TextSelection;
  context?: ContextItem[];
  /** Files that belong to this message only; sent with it when it drains. */
  attachments?: ChatAttachment[];
  steering?: boolean;
}

interface ChatQueueProps {
  messages: QueuedMessage[];
  onEdit?: (message: QueuedMessage) => void;
  onRemove?: (id: string) => void;
  onSteer?: (message: QueuedMessage) => void;
  authorsById?: Map<string, ChatMessageAuthor>;
  formatLabel?: (text: string) => string;
  showAuthorAvatars?: boolean;
}

export function ChatQueue({
  messages,
  onEdit,
  onRemove,
  onSteer,
  authorsById,
  formatLabel,
  showAuthorAvatars = false,
}: ChatQueueProps) {
  const t = useTranslations("chat.queue");
  const reduceMotion = useReducedMotion();
  const hasPendingSteer = messages.some((message) => message.steering);

  if (messages.length === 0) {
    return null;
  }

  return (
    <div
      aria-label={t("label")}
      // Every row carries the gap above it and folds it away with it; the
      // first row's gap is taken back here, so no row's spacing ever jumps.
      className="-mt-1.5 flex w-full min-w-0 flex-col"
      role="group"
    >
      <AnimatePresence initial={false}>
        {messages.map((message) => {
          const files = message.attachments ?? [];
          const fileNames = files.map((file) => file.filename).join(", ");
          const author =
            showAuthorAvatars && message.authorUserId ? (
              <MessageAuthorAvatar
                author={
                  authorsById?.get(message.authorUserId) ??
                  unknownChatMessageAuthor(message.authorUserId)
                }
                size="sm"
              />
            ) : null;
          const filesBadge =
            files.length > 0 ? (
              <span
                className="text-muted-foreground inline-flex shrink-0 items-center gap-0.5 tabular-nums"
                title={t("attachments", {
                  count: files.length,
                  names: fileNames,
                })}
              >
                <HugeiconsIcon className="size-3.5" icon={Attachment01Icon} />
                <span className="sr-only">
                  {t("attachments", { count: files.length, names: fileNames })}
                </span>
                {files.length > 1 ? (
                  <span aria-hidden="true">{files.length}</span>
                ) : null}
              </span>
            ) : null;

          // Each row folds away on its own when it's sent or removed, so the
          // rows below slide up instead of jumping.
          return (
            <m.div
              // react-doctor-disable-next-line react-doctor/no-layout-property-animation -- rows below must move up as one leaves; a transform would leave a gap
              animate={{ height: "auto", opacity: 1 }}
              className="overflow-hidden [&>div]:pt-1.5"
              // react-doctor-disable-next-line react-doctor/no-layout-property-animation -- rows below must move up as one leaves; a transform would leave a gap
              exit={{ height: 0, opacity: 0 }}
              // react-doctor-disable-next-line react-doctor/no-layout-property-animation -- rows below must move up as one leaves; a transform would leave a gap
              initial={{ height: 0, opacity: 0 }}
              key={message.id}
              transition={reduceMotion ? { duration: 0 } : TRANSITION.resize}
            >
              {/* The gap above the row, folded away with it. A flex box, so
                  the chip adds no text-line height under itself. */}
              <div className="flex">
                <Composer.Chip
                  className={COMPOSER_QUEUED_CHIP}
                  editLabel={t("edit")}
                  icon={
                    author || filesBadge ? (
                      <>
                        {author}
                        {filesBadge}
                      </>
                    ) : undefined
                  }
                  label={
                    (formatLabel ? formatLabel(message.text) : message.text) ||
                    fileNames
                  }
                  labelClassName={COMPOSER_QUEUED_CHIP_LABEL}
                  onEdit={onEdit ? () => onEdit(message) : undefined}
                  onRemove={onRemove ? () => onRemove(message.id) : undefined}
                  onSteer={
                    hasPendingSteer || !onSteer
                      ? undefined
                      : () => onSteer(message)
                  }
                  pending={Boolean(message.steering)}
                  removeLabel={
                    message.steering ? t("cancelSteering") : t("remove")
                  }
                  steerLabel={t("steer")}
                />
              </div>
            </m.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
