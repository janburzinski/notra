"use client";

import {
  ArrowUp02Icon,
  Cancel01Icon,
  Edit02Icon,
} from "@hugeicons/core-free-icons";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { useUiLabels } from "@notra/ui/components/shared/ui-labels-provider";
import { Button, type ButtonProps } from "@notra/ui/components/ui/button";
import { Spinner } from "@notra/ui/components/ui/spinner";
import { Textarea } from "@notra/ui/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import {
  COMPOSER_CHIP_ACTION,
  COMPOSER_ELEVATED_HIGHLIGHT,
  COMPOSER_ELEVATED_SHADOW,
  COMPOSER_INNER_HIGHLIGHT,
  COMPOSER_INPUT,
  COMPOSER_INPUT_PILL,
  COMPOSER_PILL_RADIUS,
  COMPOSER_SEND_ACTIVE,
  COMPOSER_SEND_BUTTON,
  COMPOSER_SEND_BUTTON_SM,
  COMPOSER_SEND_INERT,
  COMPOSER_TOOLBAR_BUTTON,
  COMPOSER_TOOLBAR_BUTTON_FILLED,
  COMPOSER_TOOLBAR_BUTTON_LABEL,
  COMPOSER_TRAY_TRANSITION,
} from "@notra/ui/constants/composer";
import { TRANSITION } from "@notra/ui/lib/motion";
import { cn } from "@notra/ui/lib/utils";
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  useReducedMotion,
} from "motion/react";
import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import type {
  ComposerCardLightOptions,
  ComposerChipProps,
  ComposerFrameProps,
  ComposerInputProps,
  ComposerNudgeProps,
  ComposerSendProps,
  ComposerToolbarButtonProps,
  ComposerToolbarProps,
} from "@notra/ui/types/composer";

function ComposerNudgeShell({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  // The tray slides open once; after that it follows its content at once,
  // so rows that animate themselves (a queued message leaving) aren't chased
  // by a second, lagging height animation.
  const [settled, setSettled] = useState(false);

  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) {
      return;
    }
    setHeight(element.offsetHeight);
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <m.div
      // react-doctor-disable-next-line react-doctor/no-layout-property-animation -- the tray has to push the input card down, a transform would leave a gap
      animate={{ height, opacity: 1 }}
      className="overflow-hidden"
      // react-doctor-disable-next-line react-doctor/no-layout-property-animation -- the tray has to push the input card down, a transform would leave a gap
      exit={{
        // react-doctor-disable-next-line react-doctor/no-layout-property-animation -- the tray has to push the input card down, a transform would leave a gap
        height: 0,
        opacity: 0,
        transition: reduceMotion ? { duration: 0 } : TRANSITION.resize,
      }}
      // react-doctor-disable-next-line react-doctor/no-layout-property-animation -- the tray has to push the input card down, a transform would leave a gap
      initial={{ height: 0, opacity: 0 }}
      onAnimationComplete={() => setSettled(true)}
      transition={
        reduceMotion || settled ? { duration: 0 } : TRANSITION.resize
      }
    >
      <div ref={contentRef}>{children}</div>
    </m.div>
  );
}

function pillRadius(size: ComposerFrameProps["size"]) {
  return size === "sm" ? "rounded-[22px]" : COMPOSER_PILL_RADIUS;
}

/** The card's inner light, or its shadow when it floats on its own. */
function cardLight({ highlight, lifted }: ComposerCardLightOptions) {
  if (highlight) {
    return lifted ? COMPOSER_ELEVATED_HIGHLIGHT : COMPOSER_INNER_HIGHLIGHT;
  }
  return lifted ? COMPOSER_ELEVATED_SHADOW : undefined;
}

/**
 * The composer as a dualtone card, the frame for every composer but the pill.
 * Queued messages sit on a tinted sheet of the same material, barely
 * narrower, tucked under the input's top edge so the two read as one stack.
 */
function CardComposerFrame({
  children,
  nudge,
  connectedTop = false,
  className,
}: Pick<
  ComposerFrameProps,
  "children" | "nudge" | "connectedTop" | "className"
>) {
  const hasNudge = Boolean(nudge);
  return (
    <div
      className={cn("flex w-full min-w-0 flex-col", className)}
      data-slot="composer"
    >
      <LazyMotion features={domAnimation} strict>
        <AnimatePresence initial={false}>
          {nudge ? (
            <ComposerNudgeShell key="nudge">
              {/* One compact line per message, its text lined up with the
                  input's text below. The bottom padding hides under the card. */}
              <div
                className={cn(
                  "border-table-card-border bg-muted/50 border border-b-0 pb-2 [&_[data-slot=composer-chip]]:py-0.5 [&_[data-slot=composer-chip]]:pl-0.75 [&_[data-slot=composer-nudge]]:px-0.5 [&_[data-slot=composer-nudge]]:py-1.5",
                  // Flush under the surface above, like the card would be.
                  connectedTop ? "rounded-t-none border-t-0" : "mx-1.5 rounded-t-[9px]"
                )}
              >
                {nudge}
              </div>
            </ComposerNudgeShell>
          ) : null}
        </AnimatePresence>
      </LazyMotion>
      <div
        className={cn(
          "border-table-card-border bg-table-card shadow-table-card relative z-10 min-w-0 overflow-hidden rounded-[10px] border",
          hasNudge && "-mt-2",
          connectedTop && !hasNudge && "rounded-t-none border-t-0"
        )}
        data-slot="composer-card"
      >
        {children}
      </div>
    </div>
  );
}

// react-doctor-disable-next-line react-doctor/no-high-complexity-react-function -- each branch is one optional slot of the frame
function ComposerFrame({
  children,
  nudge,
  connectedTop = false,
  flat = false,
  elevated = false,
  size = "default",
  highlight = false,
  surface = "default",
  className,
}: ComposerFrameProps) {
  if (!flat) {
    return (
      <CardComposerFrame
        className={className}
        connectedTop={connectedTop}
        nudge={nudge}
      >
        {children}
      </CardComposerFrame>
    );
  }

  const hasNudge = Boolean(nudge);
  const isCard = surface === "card";

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col",
        COMPOSER_TRAY_TRANSITION,
        elevated && hasNudge && COMPOSER_ELEVATED_SHADOW,
        // The pill only grows a tray to hold chips above it.
        hasNudge
          ? cn(isCard ? "bg-shell" : "bg-muted", "p-1")
          : "bg-transparent",
        pillRadius(size),
        // Chips above the pill sit near the top edge, where the pill's wide
        // corners would crowd them, so the tray's top matches the card's.
        hasNudge && "rounded-t-[18px]",
        connectedTop && "rounded-t-none",
        className
      )}
      data-slot="composer"
    >
      <LazyMotion features={domAnimation} strict>
        <AnimatePresence initial={false}>
          {nudge ? (
            <ComposerNudgeShell key="nudge">{nudge}</ComposerNudgeShell>
          ) : null}
        </AnimatePresence>
      </LazyMotion>
      <div
        className={cn(
          "min-w-0 overflow-hidden border",
          // A card-surface pill uses the shell and card tokens tables use.
          isCard
            ? "border-table-card-border bg-table-card"
            : "border-border/70 bg-background",
          // A round send button; the radius is half the single-line height so
          // wrapped lines keep the button concentric.
          "**:data-[slot=composer-send]:[corner-shape:round] **:data-[slot=composer-send]:rounded-full **:data-[slot=composer-send]:supports-[corner-shape:squircle]:rounded-full",
          size === "sm" ? "rounded-[18px]" : "rounded-[25px]",
          connectedTop && !hasNudge && "rounded-t-none border-t-0",
          cardLight({ highlight, lifted: elevated && !hasNudge })
        )}
        data-slot="composer-card"
      >
        {children}
      </div>
    </div>
  );
}

function ComposerNudge({ title, action, children }: ComposerNudgeProps) {
  const hasChips = Boolean(children);

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 px-2.25 pt-0.5 pb-1",
        hasChips && "flex-wrap"
      )}
      data-slot="composer-nudge"
    >
      {title && !hasChips ? (
        <p className="min-w-0 flex-1 text-xs font-medium wrap-anywhere">
          {title}
        </p>
      ) : null}
      {hasChips ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {children}
        </div>
      ) : null}
      {action ? (
        <div className="ml-auto flex shrink-0 items-center">{action}</div>
      ) : null}
    </div>
  );
}

function ComposerChipAction({
  icon,
  label,
  onClick,
}: {
  icon: typeof Cancel01Icon;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={label}
      className={COMPOSER_CHIP_ACTION}
      onClick={onClick}
      size="icon-xs"
      variant="ghost"
    >
      <HugeiconsIcon className="size-3" icon={icon} />
    </Button>
  );
}

function ComposerChip({
  icon,
  label,
  onRemove,
  removeLabel,
  onEdit,
  editLabel,
  onSteer,
  steerLabel,
  onClick,
  pending = false,
  className,
  labelClassName,
}: ComposerChipProps) {
  const labels = useUiLabels();
  const labelClasses = cn("max-w-[12rem] truncate", labelClassName);
  const content = (
    <>
      {icon}
      <span className={labelClasses} title={label}>
        {label}
      </span>
    </>
  );

  return (
    <span
      aria-busy={pending || undefined}
      data-slot="composer-chip"
      className={cn(
        "border-foreground/25 bg-background text-foreground inline-flex max-w-full items-center gap-1.5 rounded-md border border-dashed py-1 pr-1 pl-1.5 text-xs",
        pending && "border-foreground/15 text-muted-foreground",
        className
      )}
    >
      {onClick ? (
        <ButtonPrimitive
          aria-label={labels.composerPreview(label)}
          className="hover:text-foreground focus-visible:ring-ring/50 flex min-w-0 cursor-pointer items-center gap-1.5 rounded-sm text-left transition-colors outline-none focus-visible:ring-[3px]"
          onClick={onClick}
        >
          {content}
        </ButtonPrimitive>
      ) : (
        content
      )}
      {onSteer && !pending ? (
        <ComposerChipAction
          icon={ArrowUp02Icon}
          label={steerLabel ?? labels.composerSteer(label)}
          onClick={onSteer}
        />
      ) : null}
      {onEdit && !pending ? (
        <ComposerChipAction
          icon={Edit02Icon}
          label={editLabel ?? labels.composerEdit(label)}
          onClick={onEdit}
        />
      ) : null}
      {onRemove ? (
        <ComposerChipAction
          icon={Cancel01Icon}
          label={removeLabel ?? labels.composerRemove(label)}
          onClick={onRemove}
        />
      ) : null}
    </span>
  );
}

function ComposerInput({
  className,
  layout = "card",
  ...props
}: ComposerInputProps) {
  return (
    <Textarea
      className={cn(
        COMPOSER_INPUT,
        layout === "pill" && COMPOSER_INPUT_PILL,
        className
      )}
      data-slot="composer-input"
      {...props}
    />
  );
}

function ComposerToolbar({ children, className }: ComposerToolbarProps) {
  return (
    <div
      className={cn("flex items-center gap-1 px-2 pt-1 pb-2", className)}
      data-slot="composer-toolbar"
    >
      {children}
    </div>
  );
}

function ComposerToolbarButton({
  className,
  size = "sm",
  filled = false,
  ...props
}: ComposerToolbarButtonProps) {
  const isIconOnly = typeof size === "string" && size.startsWith("icon");

  return (
    <Button
      className={cn(
        COMPOSER_TOOLBAR_BUTTON,
        !isIconOnly && COMPOSER_TOOLBAR_BUTTON_LABEL,
        filled && COMPOSER_TOOLBAR_BUTTON_FILLED,
        className
      )}
      size={size}
      variant="ghost"
      {...props}
    />
  );
}

function ComposerSend({
  children,
  label,
  tooltip,
  busy = false,
  disabled = false,
  size = "default",
  onClick,
}: ComposerSendProps) {
  const isInert = disabled && !busy;
  const buttonProps = {
    "aria-busy": busy || undefined,
    "aria-label": label,
    className: cn(
      size === "sm" ? COMPOSER_SEND_BUTTON_SM : COMPOSER_SEND_BUTTON,
      isInert ? COMPOSER_SEND_INERT : COMPOSER_SEND_ACTIVE
    ),
    disabled,
    focusableWhenDisabled: true,
    onClick,
    size: "icon",
    variant: isInert ? "secondary" : "default",
  } satisfies ButtonProps;

  const content = busy ? (
    <Spinner className={size === "sm" ? "size-3" : "size-3.5"} />
  ) : (
    children
  );

  if (!tooltip) {
    return (
      <Button data-slot="composer-send" {...buttonProps}>
        {content}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button data-slot="composer-send" {...buttonProps} />}
      >
        {content}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

// react-doctor-disable-next-line react-doctor/only-export-components -- compound component namespace, members are all components
export const Composer = {
  Frame: ComposerFrame,
  Nudge: ComposerNudge,
  Chip: ComposerChip,
  Input: ComposerInput,
  Toolbar: ComposerToolbar,
  ToolbarButton: ComposerToolbarButton,
  Send: ComposerSend,
};
