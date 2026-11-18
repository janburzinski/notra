import type { ComponentProps, ReactNode } from "react";

import type { Button } from "../../button/components/button";

export interface ComposerFrameProps {
  children: ReactNode;
  /** Queued messages, attachments or notices, tucked under the card's top edge (or on the pill's tray). */
  nudge?: ReactNode;
  /** Drops the top radius so the frame can sit flush under another surface. */
  connectedTop?: boolean;
  /** A round pill instead of the card, with a tray only while there is a nudge. For inline composers like comments. */
  flat?: boolean;
  /** `sm` is a 36px single-line pill for dense inline composers. Pair it with `Composer.Send size="sm"`. Only applies with `flat`. */
  size?: "default" | "sm";
  /** A soft light sweeps around the border while a reply streams. */
  working?: boolean;
  className?: string;
}

export interface ComposerNudgeProps {
  title?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}

export interface ComposerChipProps {
  icon?: ReactNode;
  label: string;
  onRemove?: () => void;
  removeLabel?: string;
  onEdit?: () => void;
  editLabel?: string;
  onSteer?: () => void;
  steerLabel?: string;
  onClick?: () => void;
  previewLabel?: string;
  pending?: boolean;
  className?: string;
  labelClassName?: string;
}

export type ComposerInputProps = ComponentProps<"textarea">;

export interface ComposerToolbarProps {
  children: ReactNode;
  className?: string;
}

/** A ghost `Button`. Use `size="icon-sm"` for icon-only actions. */
export type ComposerToolbarButtonProps = Omit<
  ComponentProps<typeof Button>,
  "variant"
>;

export interface ComposerSendProps {
  children: ReactNode;
  label: string;
  tooltip?: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  /** `sm` is a 28px button for single-line inline composers. */
  size?: "default" | "sm";
  onClick?: () => void;
}
