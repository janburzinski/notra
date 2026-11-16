"use client";

import {
  Alert02Icon,
  ArrowUp02Icon,
  AtIcon,
  File02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@notra/ui/components/ui/command";
import { Composer } from "@notra/ui/components/ui/composer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@notra/ui/components/ui/popover";
import { Spinner } from "@notra/ui/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { cn } from "@notra/ui/lib/utils";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { ChatComposerAttachmentChips } from "@/components/chat/chat-composer-attachments";
import { ChatContextConnectSuggestions } from "@/components/chat/chat-context-connect-suggestions";
import { ChatContextOptionContent } from "@/components/chat/chat-context-option-content";
import { ChatInputContextRow } from "@/components/chat/chat-input-context-row";
import { ChatQueue } from "@/components/chat/chat-queue";
import { ChatSkillTagChips } from "@/components/chat/chat-skill-tag-chips";
import Link from "@/components/framework/link";
import { COMPOSER_STOP_ICON } from "@/constants/composer";
import type {
  ChatComposerContextPickerProps,
  ChatComposerNudgeProps,
  ChatComposerSendButtonProps,
  ChatInputErrorProps,
} from "@/types/components/chat-composer-parts";
import { hasNudgeChips } from "@/utils/chat-composer-nudge";

/** Sends the message, stops the reply, or cancels a send waiting on uploads. */
export function ChatComposerSendButton({
  icon,
  busy,
  disabled,
  label,
  tooltip,
  onClick,
}: ChatComposerSendButtonProps) {
  return (
    <Composer.Send
      busy={busy}
      disabled={disabled}
      label={label}
      onClick={onClick}
      tooltip={tooltip}
    >
      {icon === "queued" ? (
        <Spinner />
      ) : (
        <HugeiconsIcon
          className="size-4"
          icon={icon === "stop" ? COMPOSER_STOP_ICON : ArrowUp02Icon}
          strokeWidth={icon === "send" ? 2 : undefined}
        />
      )}
    </Composer.Send>
  );
}

/**
 * What went wrong, and a way to try again when there is one. Shaped like the
 * chips beside it, icon and text in line with theirs, but tinted so it
 * doesn't read as one more thing the message carries.
 */
function ChatInputError({ message, onRetry }: ChatInputErrorProps) {
  const tCommon = useTranslations("common");
  return (
    <span
      className={cn(
        "border-warning/25 bg-warning/10 text-foreground flex w-full min-w-0 items-center gap-1.5 rounded-md border pr-1 pl-1.5 text-xs",
        // The button fills the row's height, as tall as a chip.
        onRetry ? "py-0" : "py-1"
      )}
    >
      <HugeiconsIcon
        aria-hidden="true"
        className="text-warning size-3.5 shrink-0"
        icon={Alert02Icon}
      />
      <span className="min-w-0 flex-1 truncate" role="alert" title={message}>
        {message}
      </span>
      {onRetry ? (
        <Button onClick={onRetry} size="xs" variant="ghost">
          {tCommon("actions.tryAgain")}
        </Button>
      ) : null}
    </span>
  );
}

/**
 * The sheet above the composer: what the next message carries (the host's
 * chips, queued messages, skills, context and files), low credits, and errors.
 */
// react-doctor-disable-next-line react-doctor/no-high-complexity-react-function -- each branch is one optional row of the sheet
export function ChatComposerNudge(props: ChatComposerNudgeProps) {
  const {
    chips,
    editingTarget,
    onRetry,
    organizationSlug,
    remainingChatCredits,
    shouldShowLowCredits,
    usageLimitError,
    locked = false,
  } = props;
  const tCommon = useTranslations("common");
  const tChatShared = useTranslations("chat.shared");
  const hasChips = hasNudgeChips(props);
  const credits = tChatShared("countPluralOneChatMessage", {
    count: remainingChatCredits ?? 0,
  });
  const error = usageLimitError ? (
    <ChatInputError message={usageLimitError} onRetry={onRetry} />
  ) : null;
  return (
    <Composer.Nudge
      action={
        usageLimitError && organizationSlug ? (
          <Button
            nativeButton={false}
            render={<Link href={`/${organizationSlug}/settings/billing`} />}
            size="xs"
            variant="outline"
          >
            {tCommon("actions.upgrade")}
          </Button>
        ) : null
      }
      title={
        shouldShowLowCredits && !hasChips && !usageLimitError
          ? credits
          : undefined
      }
    >
      {/* With chips below, the error gets its own row, its button beside it. */}
      {error}
      {hasChips ? (
        <>
          {chips}
          {editingTarget ? (
            <Composer.Chip
              icon={
                <HugeiconsIcon
                  aria-hidden="true"
                  className="text-muted-foreground size-3.5"
                  icon={File02Icon}
                />
              }
              label={editingTarget.title}
            />
          ) : null}
          <ChatQueue
            authorsById={props.authorsById}
            formatLabel={props.formatQueuedLabel}
            messages={props.queuedMessages}
            onEdit={props.onEditQueued}
            onRemove={props.onRemoveQueued}
            onSteer={props.onSteerQueued}
            showAuthorAvatars={props.showAuthorAvatars}
          />
          <ChatSkillTagChips
            onRemove={locked ? undefined : props.untagSkill}
            skills={props.taggedSkills}
          />
          <ChatInputContextRow
            context={props.context}
            onClearSelection={locked ? undefined : props.onClearSelection}
            onRemoveContext={locked ? undefined : props.onRemoveContext}
            selection={props.selection}
          />
          <ChatComposerAttachmentChips
            attachments={props.attachments}
            pendingUploads={props.pendingUploads}
            removeAttachment={locked ? undefined : props.removeAttachment}
            setPreviewAttachment={props.setPreviewAttachment}
          />
          {shouldShowLowCredits ? (
            <span className="text-muted-foreground text-xs">{credits}</span>
          ) : null}
        </>
      ) : null}
    </Composer.Nudge>
  );
}

/** The @ menu: integrations and MCP servers the next message can use. */
export function ChatComposerContextPicker({
  contextOptions,
  contextPickerId,
  disabledReason,
  isInContext,
  isOpen,
  onOpenChange,
  organizationSlug,
  toggleContextItem,
}: ChatComposerContextPickerProps) {
  const tChatShared = useTranslations("chat.shared");
  const tPicker = useTranslations("chat.input.contextPicker");
  const groups = [
    {
      key: "context",
      heading: tChatShared("context"),
      options: contextOptions.filter((option) => option.kind !== "mcp"),
    },
    {
      key: "mcp",
      heading: tPicker("mcpGroup"),
      options: contextOptions.filter((option) => option.kind === "mcp"),
    },
  ].filter((group) => group.options.length > 0);
  return (
    <Popover modal onOpenChange={onOpenChange} open={isOpen}>
      <Tooltip disabled={isOpen}>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Composer.ToolbarButton
                  aria-label={tChatShared("addToolsOrContext")}
                  disabled={Boolean(disabledReason)}
                  focusableWhenDisabled
                  size="icon-sm"
                />
              }
            />
          }
        >
          <HugeiconsIcon className="size-4" icon={AtIcon} />
        </TooltipTrigger>
        <TooltipContent>
          {disabledReason ?? tChatShared("toolsAndContext")}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        align="start"
        className="w-80 p-0"
        id={contextPickerId}
        showBackdrop
        sideOffset={6}
      >
        <Command>
          <CommandInput placeholder={tChatShared("searchToolsAndContext")} />
          <CommandList>
            <CommandEmpty>
              {contextOptions.length === 0
                ? tChatShared("noMatchingIntegrations")
                : tChatShared("noMatchingToolsOrContext")}
            </CommandEmpty>
            {contextOptions.length === 0 && organizationSlug ? (
              <ChatContextConnectSuggestions
                onSelect={() => onOpenChange(false)}
                organizationSlug={organizationSlug}
              />
            ) : null}
            {groups.map((group) => (
              <CommandGroup heading={group.heading} key={group.key}>
                {group.options.map((option) => {
                  const inContext = isInContext(option.contextItem);
                  return (
                    <CommandItem
                      data-checked={inContext}
                      key={option.id}
                      keywords={[option.searchText]}
                      onSelect={() => {
                        toggleContextItem(option.contextItem, inContext);
                        onOpenChange(false);
                      }}
                      value={option.id}
                    >
                      <ChatContextOptionContent option={option} />
                      {inContext ? (
                        <HugeiconsIcon
                          className="text-primary ml-auto size-3.5"
                          icon={Tick02Icon}
                        />
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
          {organizationSlug ? (
            <div className="border-border border-t p-1">
              <Link
                className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center rounded-sm px-2 py-1.5 text-sm transition-colors outline-none"
                href={`/${organizationSlug}/integrations`}
                onClick={() => onOpenChange(false)}
              >
                {tChatShared("manageIntegrations")}
              </Link>
            </div>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
