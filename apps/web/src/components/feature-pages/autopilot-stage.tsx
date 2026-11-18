import {
  ArrowUp02Icon,
  Mail01Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { StatusBadge } from "@notra/ui/components/status-badge";
import { Composer } from "@notra/ui/components/ui/composer";
import { Github } from "@notra/ui/components/ui/svgs/github";
import { Slack } from "@notra/ui/components/ui/svgs/slack";
import { COMPOSER_ELEVATED_SHADOW } from "@notra/ui/constants/composer";
import { cn } from "@notra/ui/lib/utils";
import { domAnimation, LazyMotion, m, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import { StageShell } from "@/components/feature-pages/stage-shell";
import {
  AUTOPILOT_STAGE_IMAGE,
  AUTOPILOT_STAGE_INPUT,
  AUTOPILOT_STAGE_OUTPUTS,
  AUTOPILOT_STAGE_SCENARIOS,
  AUTOPILOT_STEP_STATUS,
} from "@/constants/feature-pages/autopilot";
import { FEATURE_STAGE_LIGHT_BADGE_TOKENS } from "@/constants/feature-pages/stage";
import type {
  AutopilotOutputLogo,
  AutopilotStageScenario,
  AutopilotStepState,
} from "@/types/autopilot-page";

const TYPE_MS = 42;
const STEP_MS = 2400;
const HOLD_MS = 5000;
const RESET_MS = 700;
const START_DELAY_MS = 600;

// After the goal is typed, each tick starts the next step and finishes the one
// before. Every scenario has the same number of steps.
const STEP_COUNT = 3;
const STEP_TICKS = STEP_COUNT + 1;

function stepState(index: number, tick: number): AutopilotStepState {
  if (tick > index + 1) {
    return "done";
  }
  if (tick === index + 1) {
    return "running";
  }
  return "queued";
}

function scenarioAt(index: number): AutopilotStageScenario {
  return AUTOPILOT_STAGE_SCENARIOS[index] ?? AUTOPILOT_STAGE_SCENARIOS[0];
}

function useWorkflowPlayback() {
  const [scenario, setScenario] = useState(0);
  const [typed, setTyped] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");

    // With reduced motion the run sits at rest: the first goal fully typed,
    // every step done, nothing animating.
    const rest = () => {
      setScenario(0);
      setTyped(scenarioAt(0).goal.length);
      setTick(STEP_TICKS);
    };

    if (query.matches) {
      rest();
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    const run = (index: number, chars: number, steps: number) => {
      const { goal } = scenarioAt(index);
      setScenario(index);
      setTyped(chars);
      setTick(steps);
      if (chars < goal.length) {
        timer = setTimeout(() => run(index, chars + 1, 0), TYPE_MS);
        return;
      }
      if (steps < STEP_TICKS) {
        timer = setTimeout(() => run(index, chars, steps + 1), STEP_MS);
        return;
      }
      // Move on in two beats: the steps reset and the lines drain while the
      // goal stays, then the input clears and the next goal types in.
      timer = setTimeout(() => {
        setTick(0);
        timer = setTimeout(
          () => run((index + 1) % AUTOPILOT_STAGE_SCENARIOS.length, 0, 0),
          RESET_MS
        );
      }, HOLD_MS);
    };

    const onMotionChange = (event: MediaQueryListEvent) => {
      clearTimeout(timer);
      if (event.matches) {
        rest();
        return;
      }
      timer = setTimeout(() => run(0, 0, 0), START_DELAY_MS);
    };
    query.addEventListener("change", onMotionChange);
    timer = setTimeout(() => run(0, 0, 0), START_DELAY_MS);

    return () => {
      query.removeEventListener("change", onMotionChange);
      clearTimeout(timer);
    };
  }, []);

  return { scenario: scenarioAt(scenario), typed, tick };
}

type LineState = "idle" | "flowing" | "filled";

// The pulse travels the line's full height (h-10) from one card to the next,
// centred on each end of the line: from half its own size (size-2.5) above
// the top edge to half its size above the bottom edge. Animated as a
// transform rather than `top`, so the run never touches layout.
const PULSE_Y_FROM = "-0.3125rem";
const PULSE_Y_TO = "2.1875rem";

// The line between two parts of the run, running under both ends so it reads
// as one line. When the run moves on, a glowing pulse leaves the card above,
// travels down it over the card edges and lands in the next card, and the
// line fills behind it. Finished lines stay solid and drain away when the loop
// starts over.
function StepLine({ state }: { state: LineState }) {
  const reduceMotion = useReducedMotion();
  return (
    <span
      aria-hidden="true"
      className="relative z-20 -my-1.5 h-10 w-[3px] shrink-0"
    >
      {/* The track only fills the gap: under an opaque card it would be hidden
          anyway, and the pulse above it may cross the card edges. */}
      <span className="absolute inset-x-0 inset-y-1.5 overflow-hidden bg-white/30">
        <span
          className={cn(
            "absolute inset-0 bg-white transition-transform motion-reduce:transition-none",
            state === "idle"
              ? "origin-bottom scale-y-0 duration-500 ease-in-out"
              : "origin-top scale-y-100 duration-450 ease-out"
          )}
        />
      </span>
      {state === "flowing" && !reduceMotion ? (
        <m.span
          animate={{
            y: PULSE_Y_TO,
            opacity: [0, 1, 1, 0],
            scale: [0.5, 1.15, 1, 0.6],
          }}
          className="absolute top-0 -left-[3.5px] size-2.5 rounded-full bg-white shadow-[0_0_6px_2px_#FFFFFF,0_0_16px_6px_rgb(255_255_255/0.6)]"
          initial={{ y: PULSE_Y_FROM, opacity: 0, scale: 0.5 }}
          transition={{
            duration: 0.45,
            ease: "easeInOut",
            times: [0, 0.15, 0.85, 1],
          }}
        />
      ) : null}
    </span>
  );
}

function lineInto(index: number, tick: number): LineState {
  const state = stepState(index, tick);
  if (state === "running") {
    return "flowing";
  }
  return state === "done" ? "filled" : "idle";
}

// When the pulse lands on a card's top edge, a dithered wave spreads out
// from that point across the whole card, and the card's border catches it
// as it reaches the edges.
const LANDING_DELAY = 0.4;
const WAVE = {
  duration: 0.75,
  ease: [0.33, 1, 0.68, 1],
  delay: LANDING_DELAY,
} as const;
// Just past the far corners of a card, so the wave is seen crossing it.
const WAVE_RADIUS = "21rem";
const DOT_TRAIL_MASK =
  "radial-gradient(circle, #000 1.1px, transparent 1.35px)";
const DOT_GRID_SIZE = "3px 3px";

function SignalLanding() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {/* One dithered wave. Only its radius grows, so the dot grid it is
          seen through stays the same size the whole way: densest at the
          wavefront, thinning out behind it. */}
      <m.span
        animate={{ "--wave-r": WAVE_RADIUS, opacity: [0, 1, 1, 0] }}
        className="absolute inset-0 bg-[radial-gradient(circle_var(--wave-r)_at_50%_0%,transparent_calc(var(--wave-r)*0.5),rgb(30_30_30/0.08)_calc(var(--wave-r)*0.75),rgb(30_30_30/0.28)_calc(var(--wave-r)*0.92),rgb(30_30_30/0.45)_calc(var(--wave-r)*0.97),transparent_var(--wave-r))]"
        initial={{ "--wave-r": "0px", opacity: 0 }}
        style={{
          maskImage: DOT_TRAIL_MASK,
          maskSize: DOT_GRID_SIZE,
          WebkitMaskImage: DOT_TRAIL_MASK,
          WebkitMaskSize: DOT_GRID_SIZE,
        }}
        transition={{
          ...WAVE,
          opacity: { ...WAVE, times: [0, 0.1, 0.65, 1] },
        }}
      />
      {/* The border catches the wave as it reaches the edges. */}
      <m.span
        animate={{ opacity: [0, 1, 0] }}
        className="absolute inset-0 rounded-md shadow-[inset_0_0_0_1px_rgb(30_30_30/0.22)]"
        initial={{ opacity: 0 }}
        transition={{
          duration: 0.9,
          ease: "easeOut",
          delay: LANDING_DELAY + 0.12,
          times: [0, 0.3, 1],
        }}
      />
    </span>
  );
}

function OutputLogo({ logo }: { logo: AutopilotOutputLogo }) {
  if (logo === "slack") {
    return <Slack aria-hidden="true" className="size-3.5 shrink-0" />;
  }
  if (logo === "github") {
    return (
      <Github aria-hidden="true" className="size-3.5 shrink-0 text-[#1E1E1E]" />
    );
  }
  return (
    <HugeiconsIcon
      aria-hidden="true"
      className="size-3.5 shrink-0 text-[#1E1E1E]"
      icon={Mail01Icon}
      strokeWidth={1.5}
    />
  );
}

export function AutopilotStage() {
  const { scenario, typed, tick } = useWorkflowPlayback();
  const typing = typed < scenario.goal.length;
  const reduceMotion = useReducedMotion();

  return (
    <LazyMotion features={domAnimation} strict>
      <StageShell
        className={cn(
          "flex flex-col items-center bg-center lg:px-16 lg:pt-12 lg:pb-12",
          FEATURE_STAGE_LIGHT_BADGE_TOKENS
        )}
        image={AUTOPILOT_STAGE_IMAGE}
      >
        <div className="relative flex w-full flex-col items-center">
          <p className="sr-only">{scenario.goal}</p>
          {/* The dashboard's Autopilot dock input (ChatInput's pill), playing a
          goal. It's a picture of the product, so it takes no focus or input.
          It keeps its light look in dark mode, like the cards below. */}
          <div
            aria-hidden="true"
            className="text-foreground relative z-10 w-full max-w-xl dark:[--accent:#f5f5f5] dark:[--background:#ffffff] dark:[--border:#e5e5e5] dark:[--foreground:#171717] dark:[--input:#ffffff] dark:[--muted-foreground:#737373] dark:[--muted:#f5f5f5] dark:[--table-card-border:#e5e5e5] dark:[--table-card:#ffffff] dark:**:data-[slot=composer-send]:shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(0,0,0,0.06)]"
            inert
          >
            <Composer.Frame elevated flat highlight surface="card">
              <div className="relative p-2">
                <div className="absolute bottom-2 left-2 z-10 flex h-8 items-center">
                  <Composer.ToolbarButton
                    aria-label={AUTOPILOT_STAGE_INPUT.attach}
                    filled
                    size="icon-sm"
                  >
                    <HugeiconsIcon className="size-4" icon={PlusSignIcon} />
                  </Composer.ToolbarButton>
                </div>
                <div className="pr-10 pl-10">
                  <div className="text-foreground relative min-h-8 w-full min-w-0 px-1.5 py-1 text-sm leading-6 wrap-anywhere whitespace-pre-wrap">
                    {/* The full goal holds the input's height, so typing and the
                    loop restarting never move anything below it. */}
                    {/* Every goal sits invisibly in the same spot, so the input is as

                        tall as the longest one and never changes height. */}

                    <span className="invisible grid">
                      {AUTOPILOT_STAGE_SCENARIOS.map(({ goal }) => (
                        <span className="[grid-area:1/1]" key={goal}>
                          {goal}
                        </span>
                      ))}
                    </span>
                    <span className="absolute inset-0 px-1.5 py-1">
                      {typed === 0 ? (
                        <span className="text-muted-foreground line-clamp-1">
                          {AUTOPILOT_STAGE_INPUT.placeholder}
                        </span>
                      ) : (
                        scenario.goal.slice(0, typed)
                      )}
                      {typing && typed > 0 ? (
                        <span className="bg-foreground ml-px inline-block h-[1.1em] w-px translate-y-[0.2em] motion-safe:animate-pulse" />
                      ) : null}
                    </span>
                  </div>
                </div>
                <div className="absolute right-2 bottom-2 flex h-8 items-center">
                  <Composer.Send
                    disabled={typing}
                    label={AUTOPILOT_STAGE_INPUT.send}
                  >
                    <HugeiconsIcon
                      className="size-4"
                      icon={ArrowUp02Icon}
                      strokeWidth={2}
                    />
                  </Composer.Send>
                </div>
              </div>
            </Composer.Frame>
          </div>

          <ol className="flex w-full max-w-xl flex-col">
            {scenario.steps.map((step, index) => {
              const state = stepState(index, tick);
              return (
                <li className="flex flex-col items-center" key={step.title}>
                  <StepLine state={lineInto(index, tick)} />
                  <div
                    className={cn(
                      "relative z-10 w-full overflow-hidden rounded-md border border-[#E5E5E5] bg-white",
                      COMPOSER_ELEVATED_SHADOW
                    )}
                  >
                    {state === "running" && !reduceMotion ? (
                      <SignalLanding />
                    ) : null}
                    <div className="relative flex w-full items-center gap-3 px-3.5 py-3.5">
                      <span className="hidden size-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-white text-[#6B6B6B] ring-1 ring-[#1E1E1E]/10 sm:flex">
                        {step.brand === "slack" ? (
                          <Slack aria-hidden="true" className="size-4.5" />
                        ) : (
                          <HugeiconsIcon
                            aria-hidden="true"

                            className="size-4.5"

                            icon={step.icon}

                            strokeWidth={1.5}
                          />
                        )}
                      </span>
                      <div className="flex min-w-0 grow flex-col gap-0.5">
                        {/* Every goal's title for this step sits in the same
                            cell, so a title that wraps on a phone doesn't
                            change the card's height between goals. */}
                        <span className="grid font-sans text-[0.9375rem]/5 font-semibold text-[#1E1E1E]">
                          {AUTOPILOT_STAGE_SCENARIOS.map((other) => (
                            <span
                              aria-hidden="true"
                              className="invisible [grid-area:1/1] sm:truncate"
                              key={other.goal}
                            >
                              {other.steps[index]?.title}
                            </span>
                          ))}
                          <span className="[grid-area:1/1] sm:truncate">
                            {step.title}
                          </span>
                        </span>
                        {/* The result pushes the detail up and out of the same line,
                            like a ticker, so the card never changes height. */}
                        <span className="relative block h-5 overflow-hidden font-sans text-[0.8125rem]/5">
                          <span
                            className={cn(
                              "absolute inset-0 truncate text-[#6B6B6B] transition-[opacity,translate] ease-[cubic-bezier(0.22,1,0.36,1)]",
                              state === "done"
                                ? "-translate-y-full opacity-0 duration-300"
                                : "translate-y-0 opacity-100 duration-300"
                            )}
                          >
                            {step.detail}
                          </span>
                          <span
                            className={cn(
                              "absolute inset-0 truncate font-medium text-[#1E1E1E] transition-[opacity,translate] ease-[cubic-bezier(0.22,1,0.36,1)]",
                              state === "done"
                                ? "translate-y-0 opacity-100 duration-300"
                                : "translate-y-full opacity-0 duration-300"
                            )}
                          >
                            {step.result}
                          </span>
                        </span>
                      </div>
                      {/* A fixed slot, so the title keeps its width as the
                        badge changes. */}
                      <span className="flex w-24 shrink-0 justify-end">
                        {/* Keyed by state so the colours swap at once. Tweening
                            them runs the square check through brown. */}
                        <StatusBadge
                          appearance={AUTOPILOT_STEP_STATUS[state].appearance}
                          key={state}
                          label={AUTOPILOT_STEP_STATUS[state].label}
                        />
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <StepLine
            state={
              stepState(STEP_COUNT - 1, tick) === "done" ? "flowing" : "idle"
            }
          />
          <div
            className={cn(
              "relative z-10 flex max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-1.5 rounded-3xl border border-[#E5E5E5] bg-white px-4 py-2.5 sm:rounded-full",
              COMPOSER_ELEVATED_SHADOW
            )}
          >
            <span className="w-full text-center font-sans text-[0.8125rem]/5 text-balance text-[#6B6B6B] sm:w-auto">
              {AUTOPILOT_STAGE_OUTPUTS.label}
            </span>
            <ul className="flex flex-wrap items-center justify-center gap-4">
              {AUTOPILOT_STAGE_OUTPUTS.items.map((item) => (
                <li className="flex items-center gap-1.5" key={item.label}>
                  <OutputLogo logo={item.logo} />
                  <span className="font-sans text-[0.8125rem]/4 font-medium text-[#1E1E1E]">
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </StageShell>
    </LazyMotion>
  );
}
