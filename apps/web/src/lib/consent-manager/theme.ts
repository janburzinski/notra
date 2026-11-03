import { ctaButtonVariants } from "@notra/ui/components/shared/cta-button";
import { cn } from "@notra/ui/lib/utils";
import type { ConsentProviderOptions, Theme } from "c15t/tanstack-start";

const colors = {
  primary: "var(--primary)",
  primaryHover: "var(--primary-hover)",
  surface: "var(--card)",
  surfaceHover: "var(--secondary)",
  border: "var(--border)",
  borderHover: "var(--ring)",
  text: "var(--foreground)",
  textMuted: "var(--muted-foreground)",
  textOnPrimary: "var(--primary-foreground)",
  overlay: "hsl(0 0% 0% / 0.5)",
  switchTrack: "var(--input)",
  switchTrackActive: "var(--primary)",
  switchThumb: "var(--card)",
};

export const consentTheme = {
  colors: {
    ...colors,
    border: "#ececec",
    borderHover: "#e5e5e5",
    text: "#1e1e1e",
    textMuted: "rgb(30 30 30 / 0.75)",
    overlay: "rgb(30 20 50 / 0.32)",
    switchTrack: "rgb(30 30 30 / 0.12)",
    switchThumb: "#ffffff",
  },
  dark: {
    ...colors,
    primary: "oklch(0.702 0.183 293.541)",
    primaryHover: "oklch(0.811 0.111 293.571)",
    textOnPrimary: "hsl(233 7% 8%)",
  },
  typography: {
    fontFamily: "var(--font-inter)",
  },
  radius: { sm: "8px", md: "12px", lg: "24px" },
  shadows: {
    lg: "0 1px 2px rgb(40 40 40 / 0.08), 0 16px 40px -12px rgb(76 29 149 / 0.22)",
  },
  // Every action gets the same quiet pill, so the banner doesn't pull the eye
  // away from the page and no choice is nudged.
  consentActions: {
    default: { variant: "neutral", mode: "stroke" },
  },
} satisfies Theme;

const smoothingStyle = {
  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
} as const;

const titleClassName =
  "font-display text-xl leading-[1.2] font-semibold tracking-[-0.015em] text-balance max-sm:text-lg";

const descriptionClassName =
  "mt-0 text-[0.90625rem] leading-normal text-pretty max-sm:text-sm";

// c15t puts some dialog buttons on `button.primary` regardless of the theme,
// so both parts get the same secondary pill.
const buttonClassName = cn(
  ctaButtonVariants({ variant: "light", size: "sm" }),
  "font-display min-w-29 border-0 text-base max-sm:h-11"
);

export const consentComponents = {
  banner: {
    root: { style: smoothingStyle },
    card: { style: smoothingStyle },
    header: { className: "gap-1.5 px-6 pt-5.5 pb-0" },
    title: { className: titleClassName },
    footer: {
      className: "flex-wrap gap-4 border-0 bg-transparent px-6 pt-5.5 pb-6",
    },
    actionGroup: { className: "gap-3" },
  },
  description: {
    banner: { className: descriptionClassName },
    dialog: { className: descriptionClassName },
  },
  button: {
    primary: { className: buttonClassName },
    secondary: { className: buttonClassName },
  },
  dialog: {
    root: { style: smoothingStyle },
    card: {
      className:
        "w-full max-w-145 shadow-[0_1px_2px_rgb(40_40_40/0.08),0_24px_60px_-16px_rgb(76_29_149/0.3)]",
      style: smoothingStyle,
    },
    header: { className: "gap-1.5 px-6 pt-6 pb-4" },
    title: { className: titleClassName },
    content: { className: "px-6 pb-6" },
  },
  manager: {
    // Pull the footer out to the card edges so its top border spans the card.
    footer: {
      className:
        "-mx-6 mt-5 w-[calc(100%+3rem)] flex-wrap gap-4 border-t border-(--c15t-border) px-6 pt-4.5",
    },
    actionGroup: { className: "gap-3" },
  },
} satisfies ConsentProviderOptions["components"];
