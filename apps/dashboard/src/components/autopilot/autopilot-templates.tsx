"use client";

import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { StatusBadge } from "@notra/ui/components/status-badge";
import {
  AnimatePresence,
  LazyMotion,
  domMax,
  m,
  useReducedMotion,
} from "motion/react";
import { useState } from "react";
import { InstrumentSection } from "ui/card";

import {
  AutopilotTemplateDialog,
  AutopilotTemplateIcon,
} from "@/components/autopilot/autopilot-template-dialog";
import { Button } from "@/components/button";
import {
  AUTOPILOT_TEMPLATE_CATEGORIES,
  AUTOPILOT_TEMPLATES,
} from "@/constants/autopilot-templates";
import type {
  AutopilotTemplate,
  AutopilotTemplateActions,
  AutopilotTemplateCardProps,
  AutopilotTemplateCategory,
} from "@/types/autopilot-templates";

export function AutopilotTemplatesSection({
  onMore,
  ...actions
}: AutopilotTemplateActions & { onMore: () => void }) {
  const reduceMotion = useReducedMotion();
  const [selected, setSelected] = useState<AutopilotTemplate | null>(null);
  // Automations that are already on live in the table above.
  const templates = AUTOPILOT_TEMPLATES.filter(
    (template) => !actions.jobs[template.kind]
  );
  const transition = {
    duration: reduceMotion ? 0 : 0.25,
    ease: [0.23, 1, 0.32, 1] as const,
  };
  // The dialog stays mounted when the last template is enabled, so it can
  // show the Active state instead of vanishing with the section.
  return (
    <>
      <LazyMotion features={domMax} strict>
        <AnimatePresence initial={false}>
          {templates.length > 0 ? (
            <m.div
              exit={{ opacity: 0 }}
              key="templates"
              transition={transition}
            >
              <InstrumentSection
                action={
                  <Button onClick={onMore} size="sm" variant="ghost">
                    Browse templates
                  </Button>
                }
                className="pt-6"
                eyebrow="Templates"
              >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <AnimatePresence initial={false} mode="popLayout">
                    {templates.map((template) => (
                      <m.div
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.96 }}
                        initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96 }}
                        key={template.id}
                        layout={!reduceMotion}
                        transition={transition}
                      >
                        <AutopilotTemplateCard
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
      </LazyMotion>
      <AutopilotTemplateDialog
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

function AutopilotTemplateCard({
  template,
  jobs,
  canManage,
  isAdding,
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
        <Button
          className="relative z-10 ml-auto"
          aria-label={`${active ? "Open automation" : "Enable template"}: ${template.name}`}
          disabled={!active && (!canManage || isAdding)}
          onClick={() => {
            if (active) {
              onOpenBuiltIn(kind);
            } else if (canManage && !isAdding) {
              onAddBuiltIn(kind);
            }
          }}
          size="sm"
          variant="ghost"
        >
          {active ? "Open automation" : "Enable template"}
        </Button>
      </div>
    </article>
  );
}
