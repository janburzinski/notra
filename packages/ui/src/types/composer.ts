import type { ButtonProps } from "@notra/ui/components/ui/button";
import type { ComponentProps, ReactNode } from "react";

export interface ComposerFrameProps {
  children: ReactNode;
  nudge?: ReactNode;
  /** Drops the top radius so the frame can sit flush under another surface. */
  connectedTop?: boolean;
  /** Tighter radius, no shadow and no tray until there is a nudge. For inline composers like comments. */
  flat?: boolean;
  /** No grey tray around the card until there is a nudge, for content that stands in for the input. */
  rimless?: boolean;
  /** Casts a shadow, for a composer floating over page content. */
  elevated?: boolean;
  /** `sm` is a 36px single-line pill for dense inline composers. Pair it with `Composer.Send size="sm"`. Only applies with `flat`. */
  size?: "default" | "sm";
  /** A soft inner light, for a pill floating over the page. */
  highlight?: boolean;
  /**
   * `card` drops the tray and draws the input as a dualtone table card, for
   * a composer that sits on a grey shell next to other cards.
   */
  surface?: "default" | "card";
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
  pending?: boolean;
  className?: string;
  labelClassName?: string;
}

export type ComposerInputProps = ComponentProps<"textarea"> & {
  /** `pill` is the floating composer's one-line input. */
  layout?: "card" | "pill";
};

export interface ComposerToolbarProps {
  children: ReactNode;
  className?: string;
}

/** A ghost `Button`. Use `size="icon-sm"` for icon-only actions. */
export type ComposerToolbarButtonProps = Omit<ButtonProps, "variant"> & {
  /** Round and filled, instead of a ghost button. */
  filled?: boolean;
};

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

export interface ComposerCardLightOptions {
  highlight: boolean;
  /** The card floats on its own, with nothing above it. */
  lifted: boolean;
}
