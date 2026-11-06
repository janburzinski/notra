"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { ArrowRight01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type * as React from "react";
import { createContext, useContext } from "react";
import {
  DROPDOWN_ITEM_CLASS_NAME,
  DROPDOWN_POPUP_CLASS_NAME,
} from "@notra/ui/constants/dropdown";
import { cn } from "@notra/ui/lib/utils";

// Where menus portal to. Unset means document.body; a Shadow DOM host sets an element inside it.
const DropdownMenuPortalContainer = createContext<HTMLElement | null>(null);

function DropdownMenu(props: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
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
  const container = useContext(DropdownMenuPortalContainer);
  return (
    <MenuPrimitive.Portal container={container ?? undefined}>
      <MenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        className="isolate z-50 outline-none"
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          className={cn(
            DROPDOWN_POPUP_CLASS_NAME,
            "w-(--anchor-width) min-w-32 p-1",
            className
          )}
          data-slot="dropdown-menu-content"
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: MenuPrimitive.GroupLabel.Props & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.GroupLabel
      className={cn(
        "px-2 py-1 font-medium text-muted-foreground text-xs data-[inset]:pl-7",
        className
      )}
      data-inset={inset || undefined}
      data-slot="dropdown-menu-label"
      {...props}
    />
  );
}

function DropdownMenuItem({
  className,
  inset,
  active,
  variant = "default",
  ...props
}: MenuPrimitive.Item.Props & {
  inset?: boolean;
  /** Marks the item that is currently in use, such as the selected branch. */
  active?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <MenuPrimitive.Item
      aria-current={active || undefined}
      className={cn(
        DROPDOWN_ITEM_CLASS_NAME,
        "group/dropdown-menu-item data-[active]:bg-menu-highlight data-[active]:text-foreground data-[inset]:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/10 data-[variant=destructive]:data-highlighted:text-destructive data-[variant=destructive]:*:[svg]:text-destructive",
        className
      )}
      data-active={active || undefined}
      data-inset={inset || undefined}
      data-slot="dropdown-menu-item"
      data-variant={variant}
      {...props}
    />
  );
}

function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.SubmenuTrigger
      className={cn(
        DROPDOWN_ITEM_CLASS_NAME,
        "data-[inset]:pl-7 data-popup-open:bg-menu-highlight",
        className
      )}
      data-inset={inset || undefined}
      data-slot="dropdown-menu-sub-trigger"
      {...props}
    >
      {children}
      <HugeiconsIcon
        className="ml-auto"
        icon={ArrowRight01Icon}
        strokeWidth={2}
      />
    </MenuPrimitive.SubmenuTrigger>
  );
}

function DropdownMenuSubContent({
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      align={align}
      alignOffset={alignOffset}
      className={cn("w-auto min-w-40", className)}
      data-slot="dropdown-menu-sub-content"
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  indicator = "check",
  ...props
}: MenuPrimitive.CheckboxItem.Props & {
  inset?: boolean;
  /**
   * `switch` shows the state while off too, for settings rather than picks.
   * `checkbox` puts a box in front of each item, for picking several.
   */
  indicator?: "check" | "switch" | "checkbox";
}) {
  return (
    <MenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        DROPDOWN_ITEM_CLASS_NAME,
        "group/dropdown-menu-checkbox-item data-[inset]:pl-7",
        indicator === "switch" && "pr-10",
        indicator === "checkbox" && "pl-7.5",
        indicator === "check" && "pr-7",
        className
      )}
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset || undefined}
      {...props}
    >
      {indicator === "checkbox" ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center rounded-[4px] border border-foreground/25 bg-background text-primary-foreground shadow-xs transition-colors group-data-checked/dropdown-menu-checkbox-item:border-primary group-data-checked/dropdown-menu-checkbox-item:bg-primary dark:bg-input/30 dark:group-data-checked/dropdown-menu-checkbox-item:bg-primary"
          data-slot="dropdown-menu-checkbox-item-box"
        >
          <MenuPrimitive.CheckboxItemIndicator className="flex">
            <HugeiconsIcon
              className="size-2.5 text-current"
              icon={Tick02Icon}
              strokeWidth={3}
            />
          </MenuPrimitive.CheckboxItemIndicator>
        </span>
      ) : null}
      {indicator === "switch" ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-2 flex h-3.5 w-6 shrink-0 items-center rounded-md corner-squircle border border-transparent bg-input p-px transition-colors duration-fast ease-out group-data-checked/dropdown-menu-checkbox-item:bg-primary motion-reduce:transition-none dark:bg-input/80 dark:group-data-checked/dropdown-menu-checkbox-item:bg-primary"
          data-slot="dropdown-menu-checkbox-item-switch"
        >
          <span className="block size-2.5 shrink-0 rounded-sm corner-squircle bg-background transition-transform duration-fast ease-out group-data-checked/dropdown-menu-checkbox-item:translate-x-full motion-reduce:transition-none dark:bg-foreground dark:group-data-checked/dropdown-menu-checkbox-item:bg-primary-foreground" />
        </span>
      ) : null}
      {indicator === "check" ? (
        <span
          className="pointer-events-none absolute right-2 flex size-3.5 items-center justify-center"
          data-slot="dropdown-menu-checkbox-item-indicator"
        >
          <MenuPrimitive.CheckboxItemIndicator>
            <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
          </MenuPrimitive.CheckboxItemIndicator>
        </span>
      ) : null}
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
  return (
    <MenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  );
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: MenuPrimitive.RadioItem.Props & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.RadioItem
      className={cn(
        DROPDOWN_ITEM_CLASS_NAME,
        "pr-7 data-[inset]:pl-7",
        className
      )}
      data-slot="dropdown-menu-radio-item"
      data-inset={inset || undefined}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex size-3.5 items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <MenuPrimitive.RadioItemIndicator>
          <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      data-slot="dropdown-menu-separator"
      {...props}
    />
  );
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "ml-auto pl-4 font-mono text-muted-foreground text-xs",
        className
      )}
      data-slot="dropdown-menu-shortcut"
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuPortalContainer,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
