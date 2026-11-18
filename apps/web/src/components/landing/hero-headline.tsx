import { useIsMobile } from "@notra/ui/hooks/use-mobile";
import { tween } from "@notra/ui/lib/motion";
import { cn } from "@notra/ui/lib/utils";
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  useReducedMotion,
} from "motion/react";
import { type ReactNode, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "use-intl";

import { CycleLine, CycleWord } from "@/components/landing/cycle-text";
import { LandingEngineIcon } from "@/components/landing/landing-engine-icon";
import {
  HERO_HEADLINE_CYCLE,
  HERO_HEADLINE_CYCLE_MOBILE,
  HERO_HEADLINE_CYCLE_MS,
} from "@/constants/landing/hero";
import { useCycleIndex } from "@/hooks/use-cycle-index";
import type {
  CycleMarkProps,
  HeroCycleWord,
  HeroHeadlineProps,
  HeroVariant,
} from "@/types/landing/hero";

const ICON_SLOT_CLASS =
  "relative ml-[0.22em] inline-flex size-[1cap] shrink-0 items-center justify-center overflow-visible align-baseline";

const ICON_SWAP = tween("slower", "emphasized");
const ICON_HIDDEN = {
  opacity: 0,
  transform: "scale(0.94)",
  filter: "blur(2px)",
} as const;
const ICON_SHOWN = {
  opacity: 1,
  transform: "scale(1)",
  filter: "blur(0px)",
} as const;

function subscribeIsClient() {
  return () => {};
}

export function useIsClient() {
  return useSyncExternalStore(
    subscribeIsClient,
    () => true,
    () => false
  );
}

export function CycleMark({
  markKey,
  animated,
  className,
  children,
}: CycleMarkProps) {
  return (
    <span className={cn(ICON_SLOT_CLASS, className)} data-cycle-piece="">
      <AnimatePresence initial={false}>
        <m.span
          animate={ICON_SHOWN}
          className="absolute inset-0 flex items-center justify-center [&_img]:size-full [&_svg]:size-full"
          exit={animated ? ICON_HIDDEN : undefined}
          initial={animated ? ICON_HIDDEN : false}
          key={markKey}
          transition={animated ? ICON_SWAP : { duration: 0 }}
        >
          {children}
        </m.span>
      </AnimatePresence>
    </span>
  );
}

function EngineMark({
  engine,
  animated,
}: Pick<HeroCycleWord, "engine"> & { animated: boolean }) {
  return (
    <CycleMark animated={animated} className="ml-0" markKey={engine}>
      <LandingEngineIcon className="size-full" engine={engine} />
    </CycleMark>
  );
}

function HeadlineLineTwo({
  word,
  prefix,
  suffix,
  animated,
  className,
}: {
  word: HeroCycleWord;
  prefix: string;
  suffix: string;
  animated: boolean;
  className: string;
}) {
  return (
    <CycleLine
      animated={animated}
      className={className}
      cycleKey={word.text}
      key={prefix}
    >
      <span className="inline-block" data-cycle-piece="">
        {prefix}
      </span>{" "}
      <span className="inline-block whitespace-nowrap">
        <EngineMark animated={animated} engine={word.engine} />
        <CycleWord
          animated={animated}
          className="ml-[0.16em] align-baseline"
          value={word.text}
        />
        <span className="inline-block whitespace-pre" data-cycle-piece="">
          {suffix}
        </span>
      </span>
    </CycleLine>
  );
}

function HeadlineBrand({
  variant,
  children,
}: {
  variant: HeroVariant;
  children: ReactNode;
}) {
  const Icon = variant.brandIcon;

  if (!Icon) {
    return children;
  }

  return (
    <span className="inline-block whitespace-nowrap">
      <CycleMark animated={false} className="ml-0" markKey={variant.id}>
        <Icon
          aria-hidden="true"
          className={cn("size-full", variant.brandIconClassName)}
        />
      </CycleMark>
      <span className="ml-[0.16em]">{children}</span>
    </span>
  );
}

export function HeroHeadline({ variant }: HeroHeadlineProps) {
  const t = useTranslations("landing.hero.variants");
  const lineTwoClassName =
    useLocale() === "de" ? "block" : "block text-[0.9em] sm:text-[1em]";
  const animated = useReducedMotion() === false;
  const cycle = useIsMobile()
    ? HERO_HEADLINE_CYCLE_MOBILE
    : HERO_HEADLINE_CYCLE;
  const index = useCycleIndex(
    animated && variant.cycles,
    HERO_HEADLINE_CYCLE_MS
  );
  const word = cycle[index % cycle.length] ?? cycle[0];

  if (!word) {
    return null;
  }

  const prefix = t(`${variant.id}.lineTwoPrefix`);
  const suffix = t(`${variant.id}.lineTwoSuffix`);

  return (
    <LazyMotion features={domAnimation}>
      <h1 className="font-display w-full max-w-[56.875rem] text-center text-[clamp(1.625rem,calc(10.6vw_-_0.5rem),2.5rem)] leading-[1.08] font-medium tracking-[-0.015em] text-[#1E1E1E] sm:mx-auto sm:text-[clamp(3.25rem,7.3vw,4rem)] sm:font-semibold lg:text-[4.75rem] lg:leading-[1.12] dark:text-white">
        <span className="block text-balance">
          {t.rich(`${variant.id}.lineOne`, {
            brand: (chunks) => (
              <HeadlineBrand variant={variant}>{chunks}</HeadlineBrand>
            ),
          })}
        </span>
        {variant.cycles ? (
          <HeadlineLineTwo
            animated={animated}
            className={lineTwoClassName}
            prefix={prefix}
            suffix={suffix}
            word={word}
          />
        ) : (
          <span className={lineTwoClassName}>
            {prefix}
            {suffix}
          </span>
        )}
      </h1>
    </LazyMotion>
  );
}
