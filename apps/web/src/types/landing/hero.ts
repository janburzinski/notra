import type { ComponentType, ReactNode, SVGProps } from "react";

import type { EngineId } from "@/types/landing/geo";

export interface HeroCycleWord {
  text: string;
  engine: EngineId;
}

export interface HeroHeadlineBrand {
  before: string;
  name: string;
  after: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export interface HeroHeadlineProps {
  word: HeroCycleWord;
  lineOne: string | HeroHeadlineBrand;
  lineTwoPrefix: string;
}

export interface CycleMarkProps {
  markKey: string;
  animated: boolean;
  className?: string;
  children: ReactNode;
}

export interface HeroVariantCopy {
  headlineLineOne: string | HeroHeadlineBrand;
  headlineLineTwoPrefix: string;
  subhead: string;
  cta: string;
  secondaryLabel: string;
  secondaryHref: string;
}
