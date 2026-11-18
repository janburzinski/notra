import type { ComponentType, SVGProps } from "react";
import type { Messages } from "use-intl";

export type PricingIconKey =
  | "tracking"
  | "traffic"
  | "feedback"
  | "images"
  | "content"
  | "social"
  | "projects"
  | "references"
  | "retention"
  | "support";

export type PricingIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type BillingPeriod = "monthly" | "yearly";

type PricingMessages = Messages["landing"]["pricing"];

type PricingFeatureId = Extract<keyof PricingMessages["features"], string>;

interface PricingFeature {
  id: PricingFeatureId;
  count?: number;
  subtitle?: PricingFeatureId;
  price?: string;
  icon: PricingIconKey;
}

type PricingCtaKind = "signup" | "mail";

interface PricingCta {
  labelId: Extract<keyof PricingMessages["cta"], string>;
  kind: PricingCtaKind;
  href: string;
  source: string;
  showArrow: boolean;
}

export interface PricingPlan {
  id: Exclude<Extract<keyof PricingMessages["plans"], string>, "free">;
  answersPerMonth: number | null;
  name: string;
  price: Record<BillingPeriod, string> | null;
  variant: "default" | "featured";
  hasAnnualBadge?: boolean;
  cta: PricingCta;
  features: PricingFeature[];
}

export interface PricingFreePlan {
  name: string;
  price: string;
  cta: PricingCta;
  features: PricingFeature[];
}

export interface TrackedEngine {
  name: string;
  src: string;
  darkSrc?: string;
  width: number;
}

export interface PricingCardProps {
  plan: PricingPlan;
  billingPeriod: BillingPeriod;
}

export interface PricingBillingToggleProps {
  value: BillingPeriod;
  onValueChange: (value: BillingPeriod) => void;
}

export interface LandingPricingSectionProps {
  className?: string;
  showHeader?: boolean;
}
