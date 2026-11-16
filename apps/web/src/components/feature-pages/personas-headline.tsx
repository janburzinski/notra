import { domAnimation, LazyMotion, useReducedMotion } from "motion/react";

import { CycleLine, CycleWord } from "@/components/landing/cycle-text";
import { CycleMark } from "@/components/landing/hero-headline";
import {
  PERSONAS_HEADLINE_CYCLE,
  PERSONAS_HEADLINE_LINE_ONE,
} from "@/constants/feature-pages/personas";
import { HERO_HEADLINE_CYCLE_MS } from "@/constants/landing/hero";
import { useCycleIndex } from "@/hooks/use-cycle-index";

export function PersonasHeadline() {
  const animated = useReducedMotion() === false;
  const index = useCycleIndex(animated, HERO_HEADLINE_CYCLE_MS);
  const persona =
    PERSONAS_HEADLINE_CYCLE[index % PERSONAS_HEADLINE_CYCLE.length];

  if (!persona) {
    return null;
  }

  return (
    <LazyMotion features={domAnimation}>
      <span className="block whitespace-nowrap">
        {PERSONAS_HEADLINE_LINE_ONE}
      </span>
      <CycleLine
        animated={animated}
        className="block whitespace-nowrap"
        cycleKey={persona.name}
      >
        <span className="inline-block" data-cycle-piece="">
          as
        </span>
        <CycleMark animated={animated} markKey={persona.name}>
          <img alt="" className="rounded-full" src={persona.avatar} />
        </CycleMark>
        <CycleWord
          animated={animated}
          className="ml-[0.16em] align-baseline"
          value={persona.name}
        />{" "}
        <span className="inline-block" data-cycle-piece="">
          would.
        </span>
      </CycleLine>
    </LazyMotion>
  );
}
