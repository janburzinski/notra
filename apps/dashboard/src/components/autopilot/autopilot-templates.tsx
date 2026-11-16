"use client";

import { Add01Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { StatusBadge } from "@notra/ui/components/status-badge";
import { EASE } from "@notra/ui/lib/motion";
import {
  AnimatePresence,
  LazyMotion,
  domMax,
  m,
  useReducedMotion,
} from "motion/react";
import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { InstrumentSection } from "ui/card";

import {
  AutopilotTemplateDialog,
  AutopilotTemplateIcon,
} from "@/components/autopilot/autopilot-template-dialog";
import { Button } from "@/components/button";
import {
  AUTOPILOT_TEMPLATE_CATEGORIES,
  AUTOPILOT_TEMPLATE_OUTPUT_CHIPS,
  AUTOPILOT_TEMPLATE_TRIGGER_CHIPS,
  AUTOPILOT_TEMPLATES,
} from "@/constants/autopilot-templates";
import {
  AUTOPILOT_HAND_OFF_MAX_FRAMES,
  AUTOPILOT_ROW_NAME_ATTRIBUTE,
} from "@/constants/autopilot-ui";
import type { AutopilotAutomationKind } from "@/types/autopilot-metrics";
import type {
  AutopilotTemplate,
  AutopilotTemplateActions,
  AutopilotTemplateHandOff,
  AutopilotTemplateHandOffTarget,
  AutopilotTemplateCardProps,
  AutopilotTemplateCategory,
} from "@/types/autopilot-templates";

/**
 * How many columns the grid has right now, so wrapping cards are known. The
 * grid unmounts with the last template and can come back, so the observer
 * follows whichever element is mounted.
 */
function useGridColumns() {
  const [grid, setGrid] = useState<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(1);
  useLayoutEffect(() => {
    if (!grid) {
      return;
    }
    const read = () =>
      setColumns(
        getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean)
          .length || 1
      );
    read();
    const observer = new ResizeObserver(read);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [grid]);
  return [setGrid, columns] as const;
}

/**
 * Keys that change only when a card wraps to another row because a template
 * left, so that card fades across while its neighbours slide. Resizing the
 * grid moves cards without a fade.
 */
function useWrapKeys(ids: string[], columns: number) {
  const signature = `${columns}|${ids.join()}`;
  const [state, setState] = useState(() => ({
    signature,
    columns,
    slots: new Map(
      ids.map((id, index) => [
        id,
        { row: Math.floor(index / columns), epoch: 0, wrapped: false },
      ])
    ),
  }));
  if (state.signature === signature) {
    return state.slots;
  }
  const slots = new Map<
    string,
    { row: number; epoch: number; wrapped: boolean }
  >();
  for (const [index, id] of ids.entries()) {
    const row = Math.floor(index / columns);
    const previous = state.slots.get(id);
    const wrapped =
      previous !== undefined &&
      state.columns === columns &&
      previous.row !== row;
    slots.set(id, {
      row,
      epoch: (previous?.epoch ?? 0) + (wrapped ? 1 : 0),
      wrapped,
    });
  }
  setState({ signature, columns, slots });
  return slots;
}

/** Cards closing the gap. A tween, so nothing creeps after it lands. */
const SLIDE = { duration: 0.3, ease: [0.25, 1, 0.5, 1] } as const;
/**
 * The label travelling to the table: starts at once and ends on time, without
 * the long creep of a strong ease-out or a spring.
 */
const HAND_OFF = { duration: 0.34, ease: [0.33, 0.7, 0.3, 1] } as const;

export function AutopilotTemplatesSection({
  onMore,
  onAddBuiltIn,
  ...actions
}: AutopilotTemplateActions & { onMore: () => void }) {
  const reduceMotion = useReducedMotion();
  const [gridRef, columns] = useGridColumns();
  const [selected, setSelected] = useState<AutopilotTemplate | null>(null);
  const [handOff, setHandOff] = useState<AutopilotTemplateHandOff | null>(null);
  // The used card leaves on the click itself, before the switch reaches the
  // cache; the next change to `jobs` (the switch, or its rollback) takes over.
  const [leaving, setLeaving] = useState<{
    kind: AutopilotAutomationKind;
    jobs: AutopilotTemplateActions["jobs"];
  } | null>(null);
  if (leaving && leaving.jobs !== actions.jobs) {
    setLeaving(null);
  }
  // Automations that are already on live in the table above.
  const templates = AUTOPILOT_TEMPLATES.filter(
    (template) =>
      !actions.jobs[template.kind] && template.kind !== leaving?.kind
  );
  const fade = { duration: reduceMotion ? 0 : 0.15, ease: EASE.out };
  // A card that wraps to another row fades across instead of travelling
  // diagonally over its neighbours.
  const slots = useWrapKeys(
    templates.map((template) => template.id),
    columns
  );
  const addFromCard = (kind: AutopilotAutomationKind, from?: HTMLElement) => {
    if (from && !reduceMotion) {
      const template = AUTOPILOT_TEMPLATES.find((item) => item.kind === kind);
      if (template) {
        setHandOff({
          id: Date.now(),
          template,
          from: from.getBoundingClientRect(),
        });
      }
    }
    setLeaving({ kind, jobs: actions.jobs });
    onAddBuiltIn(kind);
  };
  // The dialog stays mounted when the last template is enabled, so it can
  // show the Active state instead of vanishing with the section.
  return (
    <>
      <LazyMotion features={domMax} strict>
        <AnimatePresence initial={false}>
          {templates.length > 0 ? (
            <m.div exit={{ opacity: 0 }} key="templates" transition={fade}>
              <InstrumentSection
                action={
                  <Button onClick={onMore} size="sm" variant="ghost">
                    Browse templates
                  </Button>
                }
                className="pt-6"
                eyebrow="Templates"
              >
                <div
                  className="relative grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
                  ref={gridRef}
                >
                  <AnimatePresence initial={false} mode="popLayout">
                    {templates.map((template) => (
                      <m.div
                        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                        exit={{
                          opacity: 0,
                          scale: reduceMotion ? 1 : 0.97,
                          filter: reduceMotion ? "blur(0px)" : "blur(2px)",
                          transition: fade,
                        }}
                        initial={{
                          opacity: 0,
                          scale: reduceMotion ? 1 : 0.98,
                          filter: "blur(0px)",
                        }}
                        className={
                          slots.get(template.id)?.wrapped
                            ? "z-0"
                            : "relative z-1"
                        }
                        key={`${template.id}:${slots.get(template.id)?.epoch ?? 0}`}
                        layout={reduceMotion ? false : "position"}
                        transition={{
                          layout: SLIDE,
                          default: {
                            duration: reduceMotion ? 0 : 0.2,
                            ease: EASE.out,
                            delay: reduceMotion ? 0 : 0.08,
                          },
                        }}
                      >
                        <AutopilotTemplateCard
                          onAddBuiltIn={addFromCard}
                          onSelect={setSelected}
                          template={template}
                          {...actions}
                        />
                      </m.div>
                    ))}
                  </AnimatePresence>
                </div>
              </InstrumentSection>
            </m.div>
          ) : null}
        </AnimatePresence>
        {handOff ? (
          <AutopilotTemplateHandOffGhost
            handOff={handOff}
            key={handOff.id}
            onDone={() => setHandOff(null)}
          />
        ) : null}
      </LazyMotion>
      <AutopilotTemplateDialog
        onAddBuiltIn={onAddBuiltIn}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
          }
        }}
        removesActiveCards
        template={selected}
        {...actions}
      />
    </>
  );
}

/**
 * The used card's title lifts off and settles into the name cell of its new
 * row in the automations table. Template and automation share the name and
 * the type style, so only the label travels: the card's title and the row's
 * name stay hidden while it flies, and it lands exactly where the real text
 * is.
 */
function AutopilotTemplateHandOffGhost({
  handOff,
  onDone,
}: {
  handOff: AutopilotTemplateHandOff;
  onDone: () => void;
}) {
  const [target, setTarget] = useState<AutopilotTemplateHandOffTarget | null>(
    null
  );
  const [lost, setLost] = useState(false);
  const { from, template } = handOff;
  // The label starts travelling once the row has rendered, a few frames
  // after the click.
  useLayoutEffect(() => {
    let frame = 0;
    let tries = 0;
    const find = () => {
      const name = document.querySelector<HTMLElement>(
        `[${AUTOPILOT_ROW_NAME_ATTRIBUTE}="${template.kind}"]`
      );
      if (!name && tries < AUTOPILOT_HAND_OFF_MAX_FRAMES) {
        tries += 1;
        frame = requestAnimationFrame(find);
        return;
      }
      const rect = name?.getBoundingClientRect();
      if (name && rect && rect.bottom > 0 && rect.top < window.innerHeight) {
        setTarget({ x: rect.left - from.left, y: rect.top - from.top });
      } else {
        // The row is off screen: fade out with the card instead.
        setLost(true);
      }
    };
    frame = requestAnimationFrame(find);
    return () => cancelAnimationFrame(frame);
  }, [from, template]);
  let animate = {};
  if (target) {
    animate = { x: target.x, y: target.y };
  } else if (lost) {
    animate = { opacity: 0 };
  }
  // Only mounted after a click, but the server render must not reach for it.
  if (typeof document === "undefined") {
    return null;
  }
  return createPortal(
    <m.div
      animate={animate}
      aria-hidden="true"
      className="pointer-events-none fixed z-50"
      initial={{ x: 0, y: 0, opacity: 1 }}
      inert
      onAnimationComplete={() => {
        if (target || lost) {
          onDone();
        }
      }}
      style={{ top: from.top, left: from.left }}
      transition={lost ? { duration: 0.15, ease: EASE.out } : HAND_OFF}
    >
      {/*
        The card's title and the row's name stay hidden from their first
        paint until the label has landed on the row.
      */}
      <style>{`[data-autopilot-template="${template.id}"],[${AUTOPILOT_ROW_NAME_ATTRIBUTE}="${template.kind}"]{visibility:hidden}`}</style>
      {/* A plate keeps the label readable over the cards sliding under it. */}
      <m.span
        animate={target ? { opacity: [1, 1, 0, 0] } : { opacity: 1 }}
        className="bg-background shadow-lift ring-foreground/10 absolute -inset-x-2 -inset-y-1 rounded-md ring-1"
        initial={{ opacity: 1 }}
        transition={
          target
            ? { duration: 0.34, ease: "linear", times: [0, 0.55, 0.85, 1] }
            : { duration: 0 }
        }
      />
      <span className="relative block text-sm leading-5 font-medium whitespace-nowrap">
        {template.name}
      </span>
    </m.div>,
    document.body
  );
}

export function AutopilotTemplatesPage(actions: AutopilotTemplateActions) {
  const [selected, setSelected] = useState<AutopilotTemplate | null>(null);
  return (
    <div className="w-full space-y-8">
      <div className="space-y-3">
        <PageHeading
          description="Enable a template to include it in Autopilot runs."
          title="Templates"
        />
        {!actions.canManage ? (
          <p className="text-muted-foreground text-sm">
            Ask a workspace admin to enable templates.
          </p>
        ) : null}
      </div>
      {(
        Object.keys(
          AUTOPILOT_TEMPLATE_CATEGORIES
        ) as AutopilotTemplateCategory[]
      ).map((category) => (
        <section className="space-y-3" key={category}>
          <h2 className="text-muted-foreground text-sm font-medium">
            {AUTOPILOT_TEMPLATE_CATEGORIES[category]}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {AUTOPILOT_TEMPLATES.filter(
              (template) => template.category === category
            ).map((template) => (
              <AutopilotTemplateCard
                key={template.id}
                onSelect={setSelected}
                template={template}
                {...actions}
              />
            ))}
          </div>
        </section>
      ))}
      <AutopilotTemplateDialog
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
          }
        }}
        template={selected}
        {...actions}
      />
    </div>
  );
}

/** When the template runs and what it makes, like the Automations page cards. */
function AutopilotTemplateFlow({ template }: { template: AutopilotTemplate }) {
  const trigger = AUTOPILOT_TEMPLATE_TRIGGER_CHIPS[template.trigger];
  const output = AUTOPILOT_TEMPLATE_OUTPUT_CHIPS[template.output];
  return (
    <span className="text-muted-foreground flex min-w-0 items-center gap-2">
      <span className="flex items-center gap-1.5">
        <HugeiconsIcon
          aria-hidden="true"
          className="size-3.5"
          icon={trigger.icon}
        />
        {trigger.label}
      </span>
      <HugeiconsIcon
        aria-label="then"
        className="size-3 opacity-60"
        icon={ArrowRight02Icon}
        role="img"
      />
      <span className="flex items-center gap-1.5">
        <HugeiconsIcon
          aria-hidden="true"
          className="size-3.5"
          icon={output.icon}
        />
        {output.label}
      </span>
    </span>
  );
}

function AutopilotTemplateCard({
  template,
  jobs,
  canManage,
  onAddBuiltIn,
  onOpenBuiltIn,
  onSelect,
}: AutopilotTemplateCardProps) {
  const { kind } = template;
  const active = jobs[kind] === true;
  return (
    <article className="group/template border-shell-border bg-shell relative isolate flex h-full flex-col rounded-2xl border px-0.5 pt-0.5">
      <div className="border-border bg-background shadow-lift group-hover/template:bg-muted/40 flex flex-1 flex-col gap-3 rounded-[14px] border p-4 transition-colors">
        <AutopilotTemplateIcon template={template} />
        <div className="space-y-1">
          <h3 className="text-sm font-medium">
            <button
              className="focus-visible:after:ring-ring/50 cursor-pointer text-left outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-3"
              data-autopilot-template={template.id}
              data-autopilot-template-kind={template.kind}
              onClick={() => onSelect(template)}
              type="button"
            >
              {template.name}
            </button>
          </h3>
          <p className="text-muted-foreground text-sm text-pretty">
            {template.description}
          </p>
        </div>
      </div>
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-3.5 py-2 text-xs">
        {active ? (
          <StatusBadge appearance={{ variant: "success" }} label="Active" />
        ) : null}
        {!active && !canManage ? (
          <span className="text-muted-foreground">Admin access required</span>
        ) : null}
        {!active && canManage ? (
          <AutopilotTemplateFlow template={template} />
        ) : null}
        <Button
          className="relative z-10 ml-auto"
          aria-label={`${active ? "Open automation" : "Use template"}: ${template.name}`}
          disabled={!(active || canManage)}
          onClick={(event) => {
            if (active) {
              onOpenBuiltIn(kind);
            } else if (canManage) {
              onAddBuiltIn(
                kind,
                event.currentTarget
                  .closest("article")
                  ?.querySelector<HTMLElement>("[data-autopilot-template]") ??
                  undefined
              );
            }
          }}
          size="sm"
          variant={active ? "ghost" : "default"}
        >
          {active ? null : <HugeiconsIcon icon={Add01Icon} size={14} />}
          {active ? "Open automation" : "Use"}
        </Button>
      </div>
    </article>
  );
}
