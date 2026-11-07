"use client";

import {
  Cancel01Icon,
  Clock01Icon,
  File02Icon,
  GitPullRequestIcon,
  Search01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { StatusBadge } from "@notra/ui/components/status-badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@notra/ui/components/ui/dialog";
import { cn } from "@notra/ui/lib/utils";
import { useEffect, useRef } from "react";

import { Button } from "@/components/button";
import {
  AUTOPILOT_TEMPLATE_CATEGORIES,
  AUTOPILOT_TEMPLATE_OUTPUT_LABELS,
  AUTOPILOT_TEMPLATE_TONE_TEXT,
  AUTOPILOT_TEMPLATE_TONES,
  AUTOPILOT_TEMPLATE_TRIGGER_LABELS,
} from "@/constants/autopilot-templates";
import type {
  AutopilotTemplate,
  AutopilotTemplateDialogProps,
} from "@/types/autopilot-templates";

function toneText(template: AutopilotTemplate) {
  return AUTOPILOT_TEMPLATE_TONE_TEXT[
    AUTOPILOT_TEMPLATE_TONES[template.id] ?? "info"
  ];
}

/** A template's icon in its tone, shared by the card and the dialog. */
export function AutopilotTemplateIcon({
  template,
  className,
}: {
  template: AutopilotTemplate;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-background ring-foreground/10 flex size-9 shrink-0 items-center justify-center rounded-lg ring-1",
        className
      )}
    >
      <HugeiconsIcon
        aria-hidden="true"
        className={cn("size-4.5", toneText(template))}
        icon={template.icon}
        strokeWidth={1.75}
      />
    </span>
  );
}

export function AutopilotTemplateDialog({
  template,
  removesActiveCards = false,
  onOpenChange,
  jobs,
  canManage,
  isAdding,
  onAddBuiltIn,
  onOpenBuiltIn,
}: AutopilotTemplateDialogProps) {
  const returnFocus = useReturnFocus(
    template,
    // Cards of active templates are on their way out of the overview.
    removesActiveCards ? jobs : {}
  );
  return (
    <Dialog onOpenChange={onOpenChange} open={template !== null}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-3xl"
        finalFocus={returnFocus}
        showCloseButton={false}
      >
        {template ? (
          <TemplateDetails
            active={jobs[template.kind] === true}
            canManage={canManage}
            isAdding={isAdding}
            onEnable={() => onAddBuiltIn(template.kind)}
            onOpen={() => onOpenBuiltIn(template.kind)}
            template={template}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Enabling a template from the overview removes its card while the dialog is
 * open, so closing it falls back to another card, then to the surrounding tab
 * panel, instead of dropping focus on the body. Cards whose template is in
 * `leaving` are skipped, since they may still be fading out.
 */
function useReturnFocus(
  template: AutopilotTemplate | null,
  leaving: AutopilotTemplateDialogProps["jobs"]
) {
  const lastId = useRef<string | null>(null);
  const panel = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!template) {
      return;
    }
    lastId.current = template.id;
    panel.current =
      document
        .querySelector(`[data-autopilot-template="${template.id}"]`)
        ?.closest<HTMLElement>('[role="tabpanel"]') ?? null;
  }, [template]);
  return () => {
    const cards = [
      ...document.querySelectorAll<HTMLElement>("[data-autopilot-template]"),
    ].filter((card) => {
      const kind = card.dataset.autopilotTemplateKind;
      return !(kind && leaving[kind as keyof typeof leaving]);
    });
    return (
      cards.find((card) => card.dataset.autopilotTemplate === lastId.current) ??
      cards[0] ??
      (panel.current?.isConnected ? panel.current : true)
    );
  };
}

function TemplateDetails({
  template,
  active,
  canManage,
  isAdding,
  onEnable,
  onOpen,
}: {
  template: AutopilotTemplate;
  active: boolean;
  canManage: boolean;
  isAdding: boolean;
  onEnable: () => void;
  onOpen: () => void;
}) {
  const facts = [
    { icon: Search01Icon, title: "Reads", detail: template.source },
    {
      icon: Clock01Icon,
      title: "Runs",
      detail: AUTOPILOT_TEMPLATE_TRIGGER_LABELS[template.trigger],
    },
    {
      icon: template.output === "post" ? File02Icon : GitPullRequestIcon,
      title: "Hands you",
      detail:
        template.output === "post" ? "A post to review" : "A pull request",
    },
  ];

  return (
    <div className="grid max-h-[85svh] overflow-y-auto md:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="bg-shell border-shell-border flex flex-col gap-6 border-b p-6 md:border-r md:border-b-0">
        <div className="space-y-3">
          <AutopilotTemplateIcon className="size-10" template={template} />
          <div className="space-y-1.5">
            <DialogTitle className="text-base leading-snug font-semibold">
              {template.name}
            </DialogTitle>
            {active ? (
              <StatusBadge appearance={{ variant: "success" }} label="Active" />
            ) : (
              <p className="text-muted-foreground text-xs">
                {AUTOPILOT_TEMPLATE_CATEGORIES[template.category]}
              </p>
            )}
          </div>
        </div>
        <dl className="space-y-4">
          {facts.map((fact) => (
            <div className="flex gap-2.5" key={fact.title}>
              <HugeiconsIcon
                aria-hidden="true"
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
                icon={fact.icon}
              />
              <div className="min-w-0 space-y-0.5">
                <dt className="text-sm leading-5 font-medium">{fact.title}</dt>
                <dd className="text-muted-foreground text-xs">{fact.detail}</dd>
              </div>
            </div>
          ))}
        </dl>
      </aside>

      <div className="relative flex min-w-0 flex-col gap-6 p-6">
        <DialogDescription className="text-foreground pr-10 text-lg leading-snug font-semibold text-balance">
          {template.description}
        </DialogDescription>

        <TemplateFlow template={template} />

        <ul className="space-y-2.5">
          {template.highlights.map((highlight) => (
            <li className="flex gap-2.5 text-sm" key={highlight}>
              <HugeiconsIcon
                aria-hidden="true"
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
                icon={Tick02Icon}
              />
              <span className="text-pretty">{highlight}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-wrap items-center justify-end gap-3">
          {!(active || canManage) ? (
            <p className="text-muted-foreground mr-auto text-xs">
              Ask a workspace admin to enable it.
            </p>
          ) : null}
          {active ? (
            <Button onClick={onOpen} size="sm">
              Open automation
            </Button>
          ) : (
            <Button
              disabled={!canManage}
              loading={isAdding}
              onClick={onEnable}
              size="sm"
            >
              Use template
            </Button>
          )}
        </div>
        <DialogClose
          aria-label="Close"
          render={
            <Button
              className="absolute top-5 right-4.5"
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        </DialogClose>
      </div>
    </div>
  );
}

/** Where the template reads from, and what lands on your desk afterwards. */
function TemplateFlow({ template }: { template: AutopilotTemplate }) {
  const isPost = template.output === "post";
  return (
    <div
      aria-hidden="true"
      className="bg-shell border-shell-border flex items-center gap-4 rounded-xl border px-5 py-6"
    >
      <AutopilotTemplateIcon className="size-12" template={template} />
      <span className="flex shrink-0 gap-1">
        <span className="bg-foreground/20 size-1 rounded-full" />
        <span className="bg-foreground/20 size-1 rounded-full" />
        <span className="bg-foreground/20 size-1 rounded-full" />
      </span>
      <div className="bg-background shadow-lift min-w-0 flex-1 space-y-3 rounded-lg border p-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            className="text-muted-foreground size-4"
            icon={isPost ? File02Icon : GitPullRequestIcon}
          />
          <span className="truncate text-xs font-medium">
            {AUTOPILOT_TEMPLATE_OUTPUT_LABELS[template.output]}
          </span>
          <span
            className={cn(
              "ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium",
              isPost
                ? "bg-muted text-muted-foreground"
                : "bg-success/10 text-success"
            )}
          >
            {isPost ? "Draft" : "Ready to merge"}
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="bg-foreground/10 h-2 w-3/4 rounded-full" />
          <div className="bg-foreground/5 h-2 w-full rounded-full" />
          <div className="bg-foreground/5 h-2 w-2/3 rounded-full" />
        </div>
      </div>
    </div>
  );
}
