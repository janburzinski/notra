import type { ComponentType, ReactNode, SVGProps } from "react";
import type { Messages } from "use-intl";

import type { EngineId } from "@/types/landing/geo";

export interface HeroCycleWord {
  text: string;
  engine: EngineId;
}

type HeroVariantId = Extract<
  keyof Messages["landing"]["hero"]["variants"],
  string
>;

export interface HeroVariant {
  id: HeroVariantId;
  brandIcon?: ComponentType<SVGProps<SVGSVGElement>>;
  brandIconClassName?: string;
  cycles: boolean;
  secondaryHref: string;
}

export interface HeroHeadlineProps {
  variant: HeroVariant;
}

export interface CycleMarkProps {
  markKey: string;
  animated: boolean;
  className?: string;
  children: ReactNode;
}

export interface CycleLineProps {
  cycleKey: string;
  animated: boolean;
  className?: string;
  children: ReactNode;
}

export interface CycleWordProps {
  value: string;
  animated: boolean;
  className?: string;
}

export interface HeroWebsiteFormProps {
  cta: string;
  onSubmit?: () => void;
  source?: string;
}
