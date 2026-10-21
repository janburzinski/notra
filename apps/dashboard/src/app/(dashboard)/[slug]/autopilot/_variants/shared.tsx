"use client";

import {
  AiBrowserIcon,
  ArrowLeft01Icon,
  Clock01Icon,
  GitPullRequestIcon,
  GithubIcon,
  NoteIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Switch } from "@notra/ui/components/ui/switch";
import { useState } from "react";

import {
  EditorBox,
  EditorFooter,
  EditorPad,
  EditorSection,
  PickerSelect,
} from "@/components/automation/editor/editor-parts";
import { Button } from "@/components/button";

import type { TemplateDraft } from "./draft";
import {
  VARIANT_OUTPUTS,
  VARIANT_TRIGGERS,
  type VariantOutput,
  type VariantTrigger,
} from "./fixtures";

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

const MAX_INSTRUCTIONS = 2000;

/**
 * Full-page editor behind "Create" and the template cards, built from the
 * same parts as the Automations editor.
 */
export function TemplateEditorPage({
  initial,
  editing,
  onClose,
  onSave,
}: {
  initial: TemplateDraft;
  editing: boolean;
  onClose: () => void;
  onSave: (draft: TemplateDraft) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const set = <K extends keyof TemplateDraft>(
    key: K,
    value: TemplateDraft[K]
  ) => setDraft((current) => ({ ...current, [key]: value }));
  const canSave = draft.instructions.trim().length > 10;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div className="flex min-h-8 items-center">
        <button
          className="text-muted-foreground hover:text-foreground duration-fast inline-flex items-center gap-1 text-sm transition-colors"
          onClick={onClose}
          type="button"
        >
          <HugeiconsIcon className="size-4" icon={ArrowLeft01Icon} />
          Autopilot
        </button>
      </div>
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave) {
            onSave(draft);
          }
        }}
      >
        <div className="space-y-3">
          <input
            aria-label="Name"
            className="placeholder:text-muted-foreground/60 w-full bg-transparent px-1 text-2xl font-semibold tracking-tight outline-none"
            onChange={(event) => set("name", event.target.value)}
            placeholder="Untitled automation"
            value={draft.name}
          />
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-sm">
            <label className="flex items-center gap-2">
              <Switch
                checked={draft.enabled}
                onCheckedChange={(next) => set("enabled", next)}
              />
              {draft.enabled ? "Active" : "Inactive"}
            </label>
            <span aria-hidden="true" className="bg-border h-4 w-px" />
            <span className="flex items-center gap-1.5">
              <HugeiconsIcon
                className="size-4"
                icon={OUTPUT_ICONS[draft.output]}
              />
              {VARIANT_OUTPUTS[draft.output]}
            </span>
          </div>
        </div>

        <EditorSection
          hint="When it runs and what it hands back."
          label="Trigger"
        >
          <EditorBox>
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
              <span className="text-muted-foreground">On each</span>
              <PickerSelect
                ariaLabel="Runs"
                onChange={(next) => set("trigger", next as VariantTrigger)}
                options={(
                  Object.keys(VARIANT_TRIGGERS) as VariantTrigger[]
                ).map((value) => ({
                  value,
                  label: VARIANT_TRIGGERS[value],
                  icon: TRIGGER_ICONS[value],
                }))}
                value={draft.trigger}
              />
              <span className="text-muted-foreground">Autopilot opens a</span>
              <PickerSelect
                ariaLabel="Result"
                onChange={(next) => set("output", next as VariantOutput)}
                options={(Object.keys(VARIANT_OUTPUTS) as VariantOutput[]).map(
                  (value) => ({
                    value,
                    label: VARIANT_OUTPUTS[value],
                    icon: OUTPUT_ICONS[value],
                  })
                )}
                value={draft.output}
              />
            </div>
          </EditorBox>
        </EditorSection>

        <EditorSection
          hint="Autopilot follows these on every run."
          label="Instructions"
        >
          <EditorBox>
            <EditorPad>
              <div className="space-y-2">
                <textarea
                  aria-label="Instructions"
                  className="placeholder:text-muted-foreground/70 max-h-80 min-h-24 w-full resize-none overflow-y-auto bg-transparent text-sm outline-none"
                  maxLength={MAX_INSTRUCTIONS}
                  onChange={(event) => set("instructions", event.target.value)}
                  placeholder="When packages/billing/plans.ts changes, update the limits table on the pricing page."
                  value={draft.instructions}
                />
                <div className="text-muted-foreground flex items-center justify-between text-xs">
                  <span>Be specific about files, pages and tone.</span>
                  <span className="tabular-nums">
                    {draft.instructions.length} / {MAX_INSTRUCTIONS}
                  </span>
                </div>
              </div>
            </EditorPad>
          </EditorBox>
        </EditorSection>

        <EditorSection
          hint="Leave empty to let Autopilot pick the files."
          label="Scope"
        >
          <EditorBox>
            <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5">
              <span className="shrink-0 text-sm font-medium">
                Only touch these paths
              </span>
              <input
                aria-label="Only touch these paths"
                className="placeholder:text-muted-foreground/70 min-w-0 flex-1 bg-transparent text-right text-sm outline-none"
                onChange={(event) => set("paths", event.target.value)}
                placeholder="content/blog/**, docs/**"
                value={draft.paths}
              />
            </div>
          </EditorBox>
        </EditorSection>

        <EditorFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={!canSave} type="submit">
            {editing ? "Save changes" : "Add automation"}
          </Button>
        </EditorFooter>
      </form>
    </div>
  );
}
