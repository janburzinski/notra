import type { ComponentType } from "react";

export interface FooterLink {
  label: string;
  href?: string;
  external?: boolean;
}

interface FooterLinkGroup {
  title: string;
  links: readonly FooterLink[];
}

export interface FooterLinkColumn {
  groups: readonly FooterLinkGroup[];
}

export interface FooterSocialLink {
  label: string;
  href: string;
  Icon: ComponentType<{ className?: string }>;
}

export interface FooterDitheringConfig {
  speed: number;
  shape: "wave";
  type: "4x4";
  size: number;
  scale: number;
  colorBack: string;
  colorFront: string;
}

export type GlitterRgb = readonly [number, number, number];

export interface GlitterTheme {
  stops: readonly GlitterRgb[];
  highlight: GlitterRgb;
  floor: number;
}

export interface GlitterWordmarkProps {
  active: boolean;
}
