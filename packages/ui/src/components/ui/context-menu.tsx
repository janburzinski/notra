"use client";

import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { ArrowRight01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type * as React from "react";
import {
  DROPDOWN_DESTRUCTIVE_ITEM_CLASS_NAME,
  DROPDOWN_INDICATOR_CLASS_NAME,
  DROPDOWN_ITEM_CLASS_NAME,
  DROPDOWN_LABEL_CLASS_NAME,
  DROPDOWN_POPUP_CLASS_NAME,
  DROPDOWN_SEPARATOR_CLASS_NAME,
  DROPDOWN_SHORTCUT_CLASS_NAME,
} from "@notra/ui/constants/dropdown";
import { cn } from "@notra/ui/lib/utils";

function ContextMenu({ ...props }: ContextMenuPrimitive.Root.Props) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

function ContextMenuTrigger({
  onKeyDown,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  return (
    <ContextMenuPrimitive.Trigger
      data-slot="context-menu-trigger"
      {...props}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (
          !event.defaultPrevented &&
          event.target instanceof Node &&
          event.currentTarget.contains(event.target) &&
          (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))
        ) {
          event.preventDefault();
          const bounds = event.currentTarget.getBoundingClientRect();
          event.currentTarget.dispatchEvent(
            new MouseEvent("contextmenu", {
              bubbles: true,
              cancelable: true,
              button: 2,
              clientX: bounds.left,
              clientY: bounds.bottom,
            })
          );
        }
      }}
    />
  );
}

function ContextMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return (
    <ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />
  );
}

function ContextMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  className,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<
    MenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        className="isolate z-50 outline-none"
        side={side}
        sideOffset={sideOffset}
      >
        <ContextMenuPrimitive.Popup
          className={cn(DROPDOWN_POPUP_CLASS_NAME, "min-w-40 p-1", className)}
          data-slot="context-menu-content"
          {...props}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  );
}

function ContextMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
  return (
    <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
  );
}

function ContextMenuLabel({
  className,
  inset,
  ...props
}: MenuPrimitive.GroupLabel.Props & {
  inset?: boolean;
}) {
  return (
    <ContextMenuPrimitive.GroupLabel
      className={cn(DROPDOWN_LABEL_CLASS_NAME, className)}
      data-inset={inset || undefined}
      data-slot="context-menu-label"
      {...props}
    />
  );
}

function ContextMenuItem({
  className,
  inset,
  variant = "default",
  onClick,
  children,
  ...props
}: MenuPrimitive.Item.Props & {
  inset?: boolean;
  variant?: "default" | "destructive";
  onClick?: (event: React.MouseEvent) => void;
}) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        DROPDOWN_ITEM_CLASS_NAME,
        DROPDOWN_DESTRUCTIVE_ITEM_CLASS_NAME,
        "group/context-menu-item",
        className
      )}
      data-inset={inset || undefined}
      data-slot="context-menu-item"
      data-variant={variant}
      onClick={onClick}
      {...props}
    >
      {children}
    </ContextMenuPrimitive.Item>
  );
}

function ContextMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  return (
    <ContextMenuPrimitive.SubmenuRoot data-slot="context-menu-sub" {...props} />
  );
}

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  closeDelay = 200,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean;
}) {
  return (
    <ContextMenuPrimitive.SubmenuTrigger
      className={cn(
        DROPDOWN_ITEM_CLASS_NAME,
        "data-popup-open:bg-menu-highlight dark:data-popup-open:shadow-menu-highlight",
        className
      )}
      data-inset={inset || undefined}
      data-slot="context-menu-sub-trigger"
      {...props}
      closeDelay={closeDelay}
    >
      {children}
      <HugeiconsIcon
        className="-mr-0.5 ml-auto"
        icon={ArrowRight01Icon}
        strokeWidth={2}
      />
    </ContextMenuPrimitive.SubmenuTrigger>
  );
}

function ContextMenuSubContent({
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuContent>) {
  return (
    <ContextMenuContent
      align={align}
      alignOffset={alignOffset}
      className={cn("w-auto min-w-[96px]", className)}
      data-slot="context-menu-sub-content"
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: MenuPrimitive.CheckboxItem.Props) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        DROPDOWN_ITEM_CLASS_NAME,
        "pr-(--menu-indent)",
        className
      )}
      data-slot="context-menu-checkbox-item"
      {...props}
    >
      <span
        className={DROPDOWN_INDICATOR_CLASS_NAME}
        data-slot="context-menu-checkbox-item-indicator"
      >
        <ContextMenuPrimitive.CheckboxItemIndicator>
          <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
        </ContextMenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  );
}

function ContextMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
  return (
    <ContextMenuPrimitive.RadioGroup
      data-slot="context-menu-radio-group"
      {...props}
    />
  );
}

function ContextMenuRadioItem({
  className,
  children,
  ...props
}: MenuPrimitive.RadioItem.Props) {
  return (
    <ContextMenuPrimitive.RadioItem
      className={cn(
        DROPDOWN_ITEM_CLASS_NAME,
        "pr-(--menu-indent)",
        className
      )}
      data-slot="context-menu-radio-item"
      {...props}
    >
      <span
        className={DROPDOWN_INDICATOR_CLASS_NAME}
        data-slot="context-menu-radio-item-indicator"
      >
        <ContextMenuPrimitive.RadioItemIndicator>
          <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
        </ContextMenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  );
}

function ContextMenuSeparator({
  className,
  ...props
}: MenuPrimitive.Separator.Props) {
  return (
    <ContextMenuPrimitive.Separator
      className={cn(DROPDOWN_SEPARATOR_CLASS_NAME, className)}
      data-slot="context-menu-separator"
      {...props}
    />
  );
}

function ContextMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(DROPDOWN_SHORTCUT_CLASS_NAME, className)}
      data-slot="context-menu-shortcut"
      {...props}
    />
  );
}

export {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
};
