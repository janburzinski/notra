"use client";

import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";

import {
  HOVER_CARD_CLOSE_DELAY_MS,
  HOVER_CARD_DELAY_MS,
} from "@notra/ui/constants/hover-card";
import { POPUP_MOTION_CLASS_NAME } from "@notra/ui/constants/dropdown";
import { cn } from "@notra/ui/lib/utils";

function HoverCard({ ...props }: PreviewCardPrimitive.Root.Props) {
  return <PreviewCardPrimitive.Root data-slot="hover-card" {...props} />;
}

function HoverCardTrigger({
  closeDelay = HOVER_CARD_CLOSE_DELAY_MS,
  delay = HOVER_CARD_DELAY_MS,
  ...props
}: PreviewCardPrimitive.Trigger.Props) {
  return (
    <PreviewCardPrimitive.Trigger
      closeDelay={closeDelay}
      data-slot="hover-card-trigger"
      delay={delay}
      {...props}
    />
  );
}

function HoverCardContent({
  className,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 4,
  ...props
}: PreviewCardPrimitive.Popup.Props &
  Pick<
    PreviewCardPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <PreviewCardPrimitive.Portal data-slot="hover-card-portal">
      <PreviewCardPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        className="isolate z-50"
        side={side}
        sideOffset={sideOffset}
      >
        <PreviewCardPrimitive.Popup
          className={cn(
            "ring-foreground/10 bg-popover text-popover-foreground w-64 rounded-lg p-2.5 text-sm shadow-md ring-1 z-50 origin-(--transform-origin) outline-hidden",
            POPUP_MOTION_CLASS_NAME,
            className
          )}
          data-slot="hover-card-content"
          {...props}
        />
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  );
}

export { HoverCard, HoverCardTrigger, HoverCardContent };
