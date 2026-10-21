"use client";

import {
  Add01Icon,
  AiBrowserIcon,
  ArrowLeft01Icon,
  ArrowRight02Icon,
  Clock01Icon,
  GitPullRequestIcon,
  GithubIcon,
  NoteIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { InstrumentSection } from "@notra/ui/components/instrument/instrument-module";
import { StatusBadge } from "@notra/ui/components/status-badge";
import { Kbd } from "@notra/ui/components/ui/kbd";
import { cn } from "@notra/ui/lib/utils";
import { useHotkey } from "@tanstack/react-hotkeys";
import { toast } from "sonner";

import { Button } from "@/components/button";
import type { AutopilotAutomationKind } from "@/types/autopilot-metrics";

import {
  draftFrom,
  EMPTY_DRAFT,
  templateFromDraft,
  type TemplateDraft,
} from "./draft";
import {
  FEATURED_VARIANT_TEMPLATE_IDS,
  VARIANT_CATEGORIES,
  VARIANT_OUTPUTS,
  VARIANT_TEMPLATES,
  VARIANT_TONES,
  VARIANT_TRIGGERS,
  type VariantCategory,
  type VariantOutput,
  type VariantTemplate,
  type VariantTrigger,
} from "./fixtures";
import { TemplateEditorPage } from "./shared";
import { useHarness } from "./store";

type HarnessUpdate = ReturnType<typeof useHarness>[1];

/*
 * Dev-only harness: Autopilot templates laid out like the Automations page.
 * Only the three built-in jobs really turn on; the rest is local state.
 */

type Jobs = Partial<Record<AutopilotAutomationKind, boolean>>;

interface TemplateActions {
  jobs: Jobs;
  onAddBuiltIn: (kind: AutopilotAutomationKind) => void;
  onOpenBuiltIn: (kind: AutopilotAutomationKind) => void;
}

const TRIGGER_ICONS: Record<VariantTrigger, IconSvgElement> = {
  run: Clock01Icon,
  weekly: Clock01Icon,
  merge: GithubIcon,
  drop: AiBrowserIcon,
};

const OUTPUT_ICONS: Record<VariantOutput, IconSvgElement> = {
  pull_request: GitPullRequestIcon,
  post: NoteIcon,
};

const TONE_CLASSES = {
  destructive: "text-destructive",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
} as const;

const openEditor = (
  update: HarnessUpdate,
  initial: TemplateDraft,
  title: string,
  editing?: string
) =>
  update((current) => ({
    ...current,
    editor: { initial, title, editing },
  }));

function saveDraft(
  update: HarnessUpdate,
  draft: TemplateDraft,
  editing?: string
) {
  const template = templateFromDraft(draft);
  const id = editing ?? template.id;
  update((current) => {
    const added = new Set(current.added);
    if (draft.enabled) {
      added.add(id);
    } else {
      added.delete(id);
    }
    return {
      ...current,
      editor: null,
      custom: editing
        ? current.custom.map((row) =>
            row.id === editing ? { ...template, id: editing } : row
          )
        : [template, ...current.custom],
      added,
    };
  });
  toast.success(editing ? "Template updated" : `${template.name} is added`, {
    description: "Preview only, nothing was saved.",
  });
}

/** Opens the editor straight away; the result is picked inside it. */
export function AutopilotCreateButton() {
  const [{ editor }, update] = useHarness();
  const create = () => openEditor(update, EMPTY_DRAFT, "New automation");
  useHotkey("C", create, { enabled: !editor });

  return (
    <Button className="gap-1.5" onClick={create} size="sm" variant="outline">
      <HugeiconsIcon className="size-4" icon={Add01Icon} />
      Create
      <Kbd className="ml-1 hidden sm:inline-flex">C</Kbd>
    </Button>
  );
}

/** The editor page, shown instead of the overview while it's open. */
export function useTemplateEditorOpen() {
  return useHarness()[0].editor !== null;
}

export function AutopilotTemplateEditorView() {
  const [{ editor }, update] = useHarness();
  if (!editor) {
    return null;
  }
  return (
    <TemplateEditorPage
      editing={!!editor.editing}
      initial={editor.initial}
      key={editor.editing ?? editor.title}
      onClose={() => update((current) => ({ ...current, editor: null }))}
      onSave={(draft) => saveDraft(update, draft, editor.editing)}
    />
  );
}

/** Six cards under the automations table, "More" opens the full list. */
export function AutopilotTemplatesSection({
  onMore,
  ...actions
}: TemplateActions & { onMore: () => void }) {
  const [{ custom }] = useHarness();
  const featured = [
    ...custom,
    ...FEATURED_VARIANT_TEMPLATE_IDS.flatMap((id) =>
      VARIANT_TEMPLATES.filter((template) => template.id === id)
    ),
  ].slice(0, 6);

  return (
    <InstrumentSection
      action={
        <button
          className="text-muted-foreground hover:text-foreground duration-fast text-sm transition-colors"
          onClick={onMore}
          type="button"
        >
          More
        </button>
      }
      className="pt-6"
      eyebrow="Templates"
    >
      <TemplateGrid templates={featured} {...actions} />
    </InstrumentSection>
  );
}

/** The full list, like /automation/templates. */
export function AutopilotTemplatesPage({
  onBack,
  ...actions
}: TemplateActions & { onBack: () => void }) {
  const [{ custom }] = useHarness();
  const categories = Object.keys(VARIANT_CATEGORIES) as VariantCategory[];

  return (
    <div className="w-full space-y-8">
      <div className="space-y-4">
        <button
          className="text-muted-foreground hover:text-foreground duration-fast inline-flex items-center gap-1 text-sm transition-colors"
          onClick={onBack}
          type="button"
        >
          <HugeiconsIcon className="size-4" icon={ArrowLeft01Icon} />
          Autopilot
        </button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
            <p className="text-muted-foreground text-sm text-pretty">
              Start from a template or describe your own. Autopilot runs them on
              its daily schedule.
            </p>
          </div>
          <AutopilotCreateButton />
        </div>
      </div>
      {custom.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-muted-foreground text-sm font-medium">
            Your workspace
          </h2>
          <TemplateGrid templates={custom} {...actions} />
        </section>
      ) : null}
      {categories.map((category) => (
        <section className="space-y-3" key={category}>
          <h2 className="text-muted-foreground text-sm font-medium">
            {VARIANT_CATEGORIES[category]}
          </h2>
          <TemplateGrid
            templates={VARIANT_TEMPLATES.filter(
              (template) => template.category === category
            )}
            {...actions}
          />
        </section>
      ))}
    </div>
  );
}

function TemplateGrid({
  templates,
  jobs,
  onAddBuiltIn,
  onOpenBuiltIn,
}: TemplateActions & { templates: VariantTemplate[] }) {
  const [{ added }, update] = useHarness();
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {templates.map((template) => {
        const active = template.kind
          ? jobs[template.kind] === true
          : added.has(template.id);
        const select = () => {
          if (template.kind) {
            if (active) {
              onOpenBuiltIn(template.kind);
            } else {
              onAddBuiltIn(template.kind);
            }
            return;
          }
          if (template.custom) {
            openEditor(
              update,
              draftFrom(template, active),
              "Edit template",
              template.id
            );
            return;
          }
          openEditor(
            update,
            { ...draftFrom(template, true), name: template.name },
            template.name
          );
        };
        return (
          <TemplateCard
            active={active}
            key={template.id}
            onSelect={select}
            template={template}
          />
        );
      })}
    </div>
  );
}

/** Same markup as the Automations template card. */
function TemplateCard({
  template,
  active,
  onSelect,
}: {
  template: VariantTemplate;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className="group/card border-shell-border bg-shell focus-visible:ring-ring/50 flex h-full cursor-pointer flex-col rounded-2xl border px-0.5 pt-0.5 text-left outline-none focus-visible:ring-[3px]"
      onClick={onSelect}
      type="button"
    >
      <div className="border-table-card-border bg-table-card shadow-table-card group-hover/card:bg-muted/30 duration-fast flex w-full flex-1 flex-col gap-3 rounded-[14px] border p-4 transition-colors">
        <span className="bg-background text-muted-foreground ring-foreground/10 flex size-9 shrink-0 items-center justify-center rounded-lg ring-1">
          <HugeiconsIcon
            className={cn(
              "size-4.5",
              TONE_CLASSES[VARIANT_TONES[template.id] ?? "info"]
            )}
            icon={template.icon}
            strokeWidth={1.75}
          />
        </span>
        <div className="space-y-1">
          <h3 className="line-clamp-1 text-sm font-medium">{template.name}</h3>
          <p className="text-muted-foreground line-clamp-2 text-sm text-pretty">
            {template.description}
          </p>
        </div>
      </div>
      <div className="text-muted-foreground flex min-h-9 w-full items-center gap-2 px-3.5 py-2 text-xs">
        <span className="flex items-center gap-1.5">
          <HugeiconsIcon
            className="size-3.5"
            icon={TRIGGER_ICONS[template.trigger]}
          />
          {VARIANT_TRIGGERS[template.trigger]}
        </span>
        <HugeiconsIcon className="size-3 opacity-60" icon={ArrowRight02Icon} />
        <span className="flex items-center gap-1.5">
          <HugeiconsIcon
            className="size-3.5"
            icon={OUTPUT_ICONS[template.output]}
          />
          {VARIANT_OUTPUTS[template.output]}
        </span>
        <span className="ml-auto">
          {active ? (
            <StatusBadge appearance={{ variant: "success" }} label="Active" />
          ) : null}
          {!active && template.custom ? (
            <span>by {template.author}</span>
          ) : null}
        </span>
      </div>
    </button>
  );
}
