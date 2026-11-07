"use client";

import {
  Alert02Icon,
  ArrowUp02Icon,
  AtIcon,
  File02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@notra/ui/components/ui/button";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { cn } from "@notra/ui/lib/utils";
import { useId, useRef } from "react";
import { useTranslations } from "use-intl";

import { AttachmentPreviewDialog } from "@/components/chat/attachment-preview";
import {
  ChatComposerAttachButton,
  ChatComposerAttachmentChips,
  ChatComposerDropOverlay,
} from "@/components/chat/chat-composer-attachments";
import { ChatContextConnectSuggestions } from "@/components/chat/chat-context-connect-suggestions";
import { ChatContextOptionContent } from "@/components/chat/chat-context-option-content";
import { ChatEffortMenu } from "@/components/chat/chat-effort-menu";
import { ChatInputContextRow } from "@/components/chat/chat-input-context-row";
import { ChatQueue } from "@/components/chat/chat-queue";
import { ChatQuotePreview, useChatQuote } from "@/components/chat/chat-quote";
import { ChatSkillSlashMenu } from "@/components/chat/chat-skill-slash-menu";
import { ChatSkillTagChips } from "@/components/chat/chat-skill-tag-chips";
import Link from "@/components/framework/link";
import { COMPOSER_STOP_ICON } from "@/constants/composer";
import { useContentChatInput } from "@/lib/hooks/use-content-chat-input";
import { useFocusWithin } from "@/lib/hooks/use-focus-within";
import type {
  CardComposerToolbarProps,
  ChatComposerSendButtonProps,
  ChatComposerTextareaProps,
  ChatInputComposerNudgeProps,
  ChatInputContextPickerProps,
  ChatInputErrorProps,
  ChatInputProps,
  PillComposerBodyProps,
} from "@/types/components/chat-input";

const ChatInput = (props: ChatInputProps) => (
  <ContentChatInputComposer {...props} />
);

/** The text field, which also drives the slash menu of skills. */
function ChatComposerTextarea({
  input,
  pill,
  slashListId,
  editingTargetId,
}: ChatComposerTextareaProps) {
  const t = useTranslations("chat.promptInput");
  const tChatShared = useTranslations("chat.shared");
  const {
    closeSlashMenu,
    filteredSkills,
    handlePaste,
    isInputLocked,
    isLoading,
    isSlashMenuOpen,
    onComposerKeyDown,
    onComposerSelect,
    onComposerValueChange,
    placeholder,
    resizeTextarea,
    setIsFocused,
    slashIndex,
    slashListRef,
    textareaRef,
    value,
  } = input;
  const activeSkill = isSlashMenuOpen ? filteredSkills[slashIndex] : undefined;
  return (
    <Composer.Input
      aria-activedescendant={
        activeSkill ? `chat-skill-slash-option-${activeSkill.name}` : undefined
      }
      aria-autocomplete={isSlashMenuOpen ? "list" : undefined}
      aria-controls={isSlashMenuOpen ? slashListId : undefined}
      aria-describedby={editingTargetId}
      aria-expanded={isSlashMenuOpen}
      aria-haspopup={isSlashMenuOpen ? "listbox" : undefined}
      aria-label={tChatShared("sendAMessage")}
      className={
        pill
          ? "whitespace-pre-wrap"
          : "field-sizing-fixed min-h-10 whitespace-pre-wrap"
      }
      disabled={isInputLocked}
      layout={pill ? "pill" : "card"}
      onBlur={() => {
        setIsFocused(false);
        window.setTimeout(() => {
          if (!slashListRef.current?.contains(document.activeElement)) {
            closeSlashMenu();
          }
        }, 150);
      }}
      onChange={(event) => {
        onComposerValueChange(event.target.value, event.target.selectionStart);
      }}
      onFocus={() => setIsFocused(true)}
      onInput={resizeTextarea}
      onKeyDown={onComposerKeyDown}
      onPaste={handlePaste}
      onSelect={onComposerSelect}
      placeholder={
        isLoading
          ? tChatShared("queueAMessage")
          : (placeholder ?? t("placeholder"))
      }
      ref={textareaRef}
      role="combobox"
      rows={1}
      value={value}
    />
  );
}

/** Sends the message, or stops the reply that's being written. */
function ChatComposerSendButton({ input }: ChatComposerSendButtonProps) {
  const { handleSend, onStop, sendDisabled, sendLabel, sendTooltip, showStop } =
    input;
  return (
    <Composer.Send
      disabled={sendDisabled}
      label={sendLabel}
      onClick={showStop ? onStop : handleSend}
      tooltip={sendTooltip}
    >
      <HugeiconsIcon
        className="size-4"
        icon={showStop ? COMPOSER_STOP_ICON : ArrowUp02Icon}
        strokeWidth={2}
      />
    </Composer.Send>
  );
}

/**
 * The pill: "+" and send stay in the bottom corners, and only the text's room
 * around them changes, so opening is one smooth motion.
 */
function PillComposerBody({
  open,
  attachButton,
  textarea,
  sendButton,
}: PillComposerBodyProps) {
  return (
    <>
      <div className="absolute bottom-2 left-2 z-10 flex h-8 items-center">
        {attachButton}
      </div>
      <div
        className={cn(
          "duration-normal ease-emphasized transition-all motion-reduce:transition-none",
          // Closed: one row between the buttons. Open: the text takes the full
          // width, starting in line with the round "+" below it, and the
          // buttons get a row of their own.
          open ? "-ml-1 pb-10" : "pr-10 pl-10"
        )}
      >
        {textarea}
      </div>
      <div className="absolute right-2 bottom-2 flex h-8 items-center">
        {sendButton}
      </div>
    </>
  );
}

/** The card's toolbar: attach on the left; context, effort and send on the right. */
function CardComposerToolbar({
  input,
  onAddContext,
  effort,
  attachButton,
  sendButton,
}: CardComposerToolbarProps) {
  return (
    <Composer.Toolbar>
      {attachButton}
      <div className="ml-auto flex min-w-0 items-center gap-1">
        {onAddContext ? (
          <ChatInputContextPicker
            contextOptions={input.contextOptions}
            contextPickerId={input.contextPickerId}
            disabledReason={input.contextPickerDisabledReason}
            isInContext={input.isInContext}
            isOpen={input.isContextPickerOpen}
            onOpenChange={input.setIsContextPickerOpen}
            organizationSlug={input.organizationSlug}
            toggleContextItem={input.toggleContextItem}
          />
        ) : null}
        {effort ? (
          <ChatEffortMenu {...effort} disabled={input.isInputLocked} />
        ) : null}
        {sendButton}
      </div>
    </Composer.Toolbar>
  );
}

function ContentChatInputComposer(props: ChatInputProps) {
  const tChatShared = useTranslations("chat.shared");
  const input = useContentChatInput(props);
  const quoteContext = useChatQuote();
  const slashListId = useId();
  const editingTargetId = useId();
  const {
    acceptedFileTypesLabel,
    allowedChatMimeTypes,
    attachments,
    attachmentTooltipText,
    connectedTop,
    dragHandlers,
    fileInputRef,
    filteredSkills,
    insertSlashSkill,
    isDraggingFile,
    isInputLocked,
    isSlashMenuOpen,
    onAttach,
    onFileInputChange,
    pendingUploads,
    previewAttachment,
    setPreviewAttachment,
    showComposerNudge,
    skillCount,
    slashIndex,
    slashListRef,
    value,
  } = input;
  const pill = props.layout === "pill";
  const sectionRef = useRef<HTMLElement | null>(null);
  const focusWithin = useFocusWithin(sectionRef, pill);
  // The pill opens to two rows while you write, then settles back to one.
  const pillOpen =
    pill &&
    (props.pillExpanded === true || focusWithin || value.trim().length > 0);
  const textarea = (
    <ChatComposerTextarea
      editingTargetId={props.editingTarget ? editingTargetId : undefined}
      input={input}
      pill={pill}
      slashListId={slashListId}
    />
  );
  const attachButton = (
    <ChatComposerAttachButton
      attachmentCount={attachments.length}
      disabled={isInputLocked}
      filled={pill}
      onAttach={onAttach}
      pendingUploadCount={pendingUploads.length}
      tooltip={attachmentTooltipText}
    />
  );
  const sendButton = <ChatComposerSendButton input={input} />;

  return (
    <>
      {isDraggingFile ? (
        <ChatComposerDropOverlay
          acceptedFileTypesLabel={acceptedFileTypesLabel}
        />
      ) : null}
      <div
        className="relative w-full min-w-0"
        data-chat-quote-composer={quoteContext?.scopeId}
        {...dragHandlers}
      >
        {isSlashMenuOpen ? (
          <ChatSkillSlashMenu
            filteredSkills={filteredSkills}
            listboxId={slashListId}
            onSelect={insertSlashSkill}
            skillCount={skillCount}
            slashIndex={slashIndex}
            slashListRef={slashListRef}
          />
        ) : null}
        <Composer.Frame
          connectedTop={connectedTop}
          elevated={pill && props.elevated !== false}
          flat={pill}
          // The inner light is for the pill floating on its own. Inside the
          // open dock it sits beside the conversation card and matches it.
          highlight={pill && props.pillExpanded !== true}
          nudge={
            showComposerNudge || props.editingTarget || props.chips ? (
              <ChatInputComposerNudge
                {...input}
                chips={props.chips}
                editingTarget={props.editingTarget}
                onRetry={props.onRetry}
              />
            ) : null
          }
        >
          <section
            aria-label={tChatShared("chatInputDropArea")}
            ref={sectionRef}
            className={pill ? "relative p-2" : undefined}
          >
            {props.editingTarget ? (
              <span className="sr-only" id={editingTargetId}>
                {props.editingTarget.description}
              </span>
            ) : null}
            <ChatQuotePreview />
            <input
              accept={`${allowedChatMimeTypes.join(",")},image/heic,.heic`}
              className="hidden"
              multiple
              onChange={onFileInputChange}
              ref={fileInputRef}
              type="file"
            />
            {pill ? (
              <PillComposerBody
                attachButton={attachButton}
                open={pillOpen}
                sendButton={sendButton}
                textarea={textarea}
              />
            ) : (
              <>
                {textarea}
                <CardComposerToolbar
                  attachButton={attachButton}
                  effort={props.effort}
                  input={input}
                  onAddContext={props.onAddContext}
                  sendButton={sendButton}
                />
              </>
            )}
          </section>
        </Composer.Frame>
      </div>
      <AttachmentPreviewDialog
        attachment={previewAttachment}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewAttachment(null);
          }
        }}
        open={previewAttachment !== null}
      />
    </>
  );
}

function ChatInputComposerNudge(props: ChatInputComposerNudgeProps) {
  const {
    chips,
    onRetry,
    editingTarget,
    hasAttachmentChips,
    hasContextChips,
    organizationSlug,
    remainingChatCredits,
    shouldShowLowCredits,
    usageLimitError,
  } = props;
  const tCommon = useTranslations("common");
  const tChatShared = useTranslations("chat.shared");
  const hasChips =
    hasContextChips ||
    hasAttachmentChips ||
    Boolean(editingTarget) ||
    Boolean(chips);
  const action =
    usageLimitError && organizationSlug ? (
      <Button
        nativeButton={false}
        render={<Link href={`/${organizationSlug}/settings/billing`} />}
        size="xs"
        variant="outline"
      >
        {tCommon("actions.upgrade")}
      </Button>
    ) : null;
  const error = usageLimitError ? (
    <ChatInputError message={usageLimitError} onRetry={onRetry} />
  ) : null;
  return (
    <Composer.Nudge
      action={action}
      title={
        shouldShowLowCredits && !hasChips && !usageLimitError
          ? tChatShared("countPluralOneChatMessage", {
              count: remainingChatCredits ?? 0,
            })
          : undefined
      }
    >
      {hasChips ? (
        <>
          {/* With chips below, the error gets its own row, its button beside it. */}
          {error}
          <ChatInputNudgeChips {...props} />
        </>
      ) : (
        error
      )}
    </Composer.Nudge>
  );
}

/** What the next message carries: the host's chips, queued messages, skills, context and files. */
function ChatInputNudgeChips({
  chips,
  attachments,
  context,
  editingTarget,
  onClearSelection,
  onEditQueued,
  onRemoveContext,
  onRemoveQueued,
  onSteerQueued,
  pendingUploads,
  queuedMessages,
  remainingChatCredits,
  removeAttachment,
  selection,
  setPreviewAttachment,
  shouldShowLowCredits,
  taggedSkills,
  untagSkill,
}: ChatInputComposerNudgeProps) {
  const tChatShared = useTranslations("chat.shared");
  return (
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
        messages={queuedMessages}
        onEdit={onEditQueued}
        onRemove={onRemoveQueued}
        onSteer={onSteerQueued}
      />
      <ChatSkillTagChips onRemove={untagSkill} skills={taggedSkills} />
      <ChatInputContextRow
        context={context}
        onClearSelection={onClearSelection}
        onRemoveContext={onRemoveContext}
        selection={selection}
      />
      <ChatComposerAttachmentChips
        attachments={attachments}
        pendingUploads={pendingUploads}
        removeAttachment={removeAttachment}
        setPreviewAttachment={setPreviewAttachment}
      />
      {shouldShowLowCredits ? (
        <span className="text-muted-foreground text-xs">
          {tChatShared("countPluralOneChatMessage", {
            count: remainingChatCredits ?? 0,
          })}
        </span>
      ) : null}
    </>
  );
}

/** What went wrong, and a way to try again when there is one. */
function ChatInputError({ message, onRetry }: ChatInputErrorProps) {
  const tCommon = useTranslations("common");
  return (
    <span className="flex w-full min-w-0 items-center gap-1.5 text-sm">
      <HugeiconsIcon
        aria-hidden="true"
        className="text-warning size-4 shrink-0"
        icon={Alert02Icon}
      />
      <span className="min-w-0 flex-1 truncate" role="alert">
        {message}
      </span>
      {onRetry ? (
        <Button onClick={onRetry} size="xs" variant="outline">
          {tCommon("actions.tryAgain")}
        </Button>
      ) : null}
    </span>
  );
}

function ChatInputContextPicker({
  contextOptions,
  contextPickerId,
  disabledReason,
  isInContext,
  isOpen,
  onOpenChange,
  organizationSlug,
  toggleContextItem,
}: ChatInputContextPickerProps) {
  const tChatShared = useTranslations("chat.shared");
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
            {contextOptions.length > 0 ? (
              <CommandGroup heading={tChatShared("context")}>
                {contextOptions.map((option) => {
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
            ) : null}
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

export default ChatInput;
