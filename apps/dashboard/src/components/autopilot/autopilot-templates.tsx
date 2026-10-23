"use client";

import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { InstrumentSection } from "@notra/ui/components/instrument/instrument-module";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { StatusBadge } from "@notra/ui/components/status-badge";
import { cn } from "@notra/ui/lib/utils";

import { Button } from "@/components/button";
import {
  AUTOPILOT_FEATURED_TEMPLATE_IDS,
  AUTOPILOT_TEMPLATE_CATEGORIES,
  AUTOPILOT_TEMPLATE_TONES,
  AUTOPILOT_TEMPLATES,
} from "@/constants/autopilot-templates";
import type {
  AutopilotTemplateActions,
  AutopilotTemplateCardProps,
  AutopilotTemplateCategory,
} from "@/types/autopilot-templates";

export function AutopilotTemplatesSection({
  onMore,
  ...actions
}: AutopilotTemplateActions & { onMore: () => void }) {
  return (
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
        {AUTOPILOT_FEATURED_TEMPLATE_IDS.map((id) => {
          const template = AUTOPILOT_TEMPLATES.find((row) => row.id === id);
          return template ? (
            <AutopilotTemplateCard key={id} template={template} {...actions} />
          ) : null;
        })}
      </div>
    </InstrumentSection>
  );
}

export function AutopilotTemplatesPage({
  onBack,
  ...actions
}: AutopilotTemplateActions & { onBack: () => void }) {
  return (
    <div className="w-full space-y-8">
      <div className="space-y-4">
        <Button onClick={onBack} size="sm" variant="ghost">
          <HugeiconsIcon aria-hidden="true" icon={ArrowLeft01Icon} size={16} />
          Back to Autopilot
        </Button>
        <PageHeading title="Templates" />
        <p className="text-muted-foreground text-sm text-pretty">
          Enable a template to include it in Autopilot runs. Templates marked
          “Not yet available” cannot be enabled.
        </p>
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
                template={template}
                {...actions}
              />
            ))}
          </div>
        </section>
      ))}
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
}: AutopilotTemplateCardProps) {
  const { kind } = template;
  const active = kind ? jobs[kind] === true : false;
  return (
    <article className="border-shell-border bg-shell flex h-full flex-col rounded-2xl border px-0.5 pt-0.5">
      <div className="border-border bg-background shadow-lift flex flex-1 flex-col gap-3 rounded-[14px] border p-4">
        <span className="bg-background text-muted-foreground ring-foreground/10 flex size-9 shrink-0 items-center justify-center rounded-lg ring-1">
          <HugeiconsIcon
            aria-hidden="true"
            className={cn("size-4.5", {
              "text-destructive":
                AUTOPILOT_TEMPLATE_TONES[template.id] === "destructive",
              "text-info": AUTOPILOT_TEMPLATE_TONES[template.id] === "info",
              "text-success":
                AUTOPILOT_TEMPLATE_TONES[template.id] === "success",
              "text-warning":
                AUTOPILOT_TEMPLATE_TONES[template.id] === "warning",
            })}
            icon={template.icon}
            strokeWidth={1.75}
          />
        </span>
        <div className="space-y-1">
          <h3 className="text-sm font-medium">{template.name}</h3>
          <p className="text-muted-foreground text-sm text-pretty">
            {template.description}
          </p>
        </div>
      </div>
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-3.5 py-2 text-xs">
        {kind ? (
          <>
            {active ? (
              <StatusBadge appearance={{ variant: "success" }} label="Active" />
            ) : (
              <span className="text-muted-foreground">
                {canManage ? "Available" : "Admin access required"}
              </span>
            )}
            <Button
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
          </>
        ) : (
          <span className="text-muted-foreground">Not yet available</span>
        )}
      </div>
    </article>
  );
}
