import {
  ContentIcon,
  ImagesIcon,
  ProjectsIcon,
  ReferencesIcon,
  RetentionIcon,
  SocialIcon,
  SupportIcon,
  TrackingIcon,
  TrafficIcon,
  ZdrIcon,
} from "@/components/landing/pricing-icons";
import type { PricingIcon, PricingIconKey } from "@/types/landing/pricing";

export const PRICING_ICONS: Record<PricingIconKey, PricingIcon> = {
  tracking: TrackingIcon,
  traffic: TrafficIcon,
  images: ImagesIcon,
  content: ContentIcon,
  social: SocialIcon,
  projects: ProjectsIcon,
  references: ReferencesIcon,
  retention: RetentionIcon,
  support: SupportIcon,
  zdr: ZdrIcon,
};
