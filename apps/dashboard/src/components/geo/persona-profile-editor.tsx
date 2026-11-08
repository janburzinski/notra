"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { GEO_PERSONA_FIELD_MAX_LENGTH } from "@notra/geo-core/constants/geo-personas";
import { geoPersonaEditableDetailsSchema } from "@notra/geo-core/schemas/geo-personas";
import { hasGeoPersonaDetailsChanged } from "@notra/geo-core/utils/geo-personas";
import { Badge } from "@notra/ui/components/ui/badge";
import { Input } from "@notra/ui/components/ui/input";
import { Textarea } from "@notra/ui/components/ui/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { GEO_PERSONA_PROFILE_SECTIONS } from "@/constants/geo-personas";
import {
  useGeoPersonasGenerate,
  useGeoPersonaUpdate,
} from "@/lib/hooks/use-geo-personas";
import type {
  PersonaProfileEditorProps,
  PersonaProfileFormValues,
} from "@/types/geo-personas-ui";
import { groupPersonaMemories, personaPointsText } from "@/utils/geo-personas";

function unsplitPoints(value: string, stored: string) {
  return value === personaPointsText(stored) ? stored : value;
}

export function PersonaProfileEditor({
  persona,
  organizationId,
  onCancel,
}: PersonaProfileEditorProps) {
  const t = useTranslations("geo.personaProfileEditor");
  const tCommon2 = useTranslations("common");
  const tGeoShared = useTranslations("geo.shared");
  const tCommon = useTranslations("common.actions");
  const tLabels = useTranslations("common.labels");
  const id = useId();
  const update = useGeoPersonaUpdate(organizationId);
  const generatePersona = useGeoPersonasGenerate(organizationId);
  const isPending = update.isPending || generatePersona.isPending;
  let submitLabel = t("savePersona");
  if (update.isPending) {
    submitLabel = tCommon("saving");
  } else if (generatePersona.isPending) {
    submitLabel = t("regeneratingPrompts");
  }
  const [error, setError] = useState<string | null>(null);
  const [stackDraft, setStackDraft] = useState("");
  const stackInput = useRef<HTMLInputElement>(null);
  const defaultValues: PersonaProfileFormValues = {
    name: persona.name,
    role: persona.role,
    company: persona.company,
    summary: personaPointsText(persona.summary),
    searchStyle: personaPointsText(persona.searchStyle),
    sections: {
      goals: persona.profile.goals.join("\n"),
      painPoints: persona.profile.painPoints.join("\n"),
      buyingTriggers: persona.profile.buyingTriggers.join("\n"),
      objections: persona.profile.objections.join("\n"),
    },
    currentStack: [...new Set(persona.profile.currentStack)],
  };
  const form = useForm({
    defaultValues,
    onSubmit: ({ value }) => {
      const sectionText = {
        ...value.sections,
        currentStack: [...new Set([...value.currentStack, stackDraft.trim()])]
          .filter(Boolean)
          .join("\n"),
      };
      const profile = Object.fromEntries(
        GEO_PERSONA_PROFILE_SECTIONS.map(({ key }) => [
          key,
          sectionText[key]
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        ])
      );
      const parsed = geoPersonaEditableDetailsSchema.safeParse({
        name: value.name,
        role: value.role,
        company: value.company,
        summary: unsplitPoints(value.summary, persona.summary),
        searchStyle: unsplitPoints(value.searchStyle, persona.searchStyle),
        profile,
      });
      if (!parsed.success) {
        setError(
          parsed.error.issues
            .map((issue) => `${issue.path.join(" · ")}: ${issue.message}`)
            .join(". ")
        );
        return;
      }
      setError(null);
      const commitStack = () => {
        form.setFieldValue("currentStack", [
          ...new Set(parsed.data.profile.currentStack),
        ]);
        setStackDraft("");
      };
      if (!hasGeoPersonaDetailsChanged(persona, parsed.data)) {
        commitStack();
        toast.success(t("saved"));
        onCancel();
        return;
      }
      update.mutate(
        { personaId: persona.id, details: parsed.data },
        {
          onSuccess: () => {
            commitStack();
            toast.success(t("savedRegenerating"));
            generatePersona.mutate({
              personaId: persona.id,
              promptsOnly: true,
            });
            onCancel();
          },
        }
      );
    },
  });
  const stack = useStore(form.store, (state) => state.values.currentStack);
  return (
    <form
      className="flex h-full min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
    >
      <fieldset
        disabled={isPending}
        className="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-6"
      >
        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor={`${id}-name`}>
            {tCommon2("labels.name")}
          </label>
          <form.Field name="name">
            {(field) => (
              <Input
                id={`${id}-name`}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                maxLength={GEO_PERSONA_FIELD_MAX_LENGTH}
                required
              />
            )}
          </form.Field>
        </div>
        <section className="space-y-4 border-t pt-6">
          <h3 className="text-base font-semibold">{t("employment")}</h3>
          <div className="space-y-5">
            <div className="space-y-2">
              <label
                className="block text-sm font-medium"
                htmlFor={`${id}-role`}
              >
                {t("jobTitle")}
              </label>
              <form.Field name="role">
                {(field) => (
                  <Input
                    id={`${id}-role`}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    maxLength={200}
                    required
                  />
                )}
              </form.Field>
            </div>
            <div className="space-y-2">
              <label
                className="block text-sm font-medium"
                htmlFor={`${id}-company`}
              >
                {t("companyProfile")}
              </label>
              <form.Field name="company">
                {(field) => (
                  <Textarea
                    className="resize-none"
                    id={`${id}-company`}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    maxLength={200}
                    required
                    rows={2}
                  />
                )}
              </form.Field>
            </div>
          </div>
        </section>
        <section className="space-y-4 border-t pt-6">
          <h3 className="text-base font-semibold">{t("behavior")}</h3>
          <div className="space-y-5">
            <div className="space-y-2">
              <label
                className="block text-sm font-medium"
                htmlFor={`${id}-summary`}
              >
                {t("motivations")}
              </label>
              <form.Field name="summary">
                {(field) => (
                  <Textarea
                    className="resize-none"
                    id={`${id}-summary`}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    maxLength={800}
                    required
                    rows={3}
                  />
                )}
              </form.Field>
            </div>
            <div className="space-y-2">
              <label
                className="block text-sm font-medium"
                htmlFor={`${id}-searchStyle`}
              >
                {t("howTheySearch")}
              </label>
              <form.Field name="searchStyle">
                {(field) => (
                  <Textarea
                    className="resize-none"
                    id={`${id}-searchStyle`}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    maxLength={800}
                    required
                    rows={3}
                  />
                )}
              </form.Field>
            </div>
            {GEO_PERSONA_PROFILE_SECTIONS.map((section) => (
              <div className="space-y-2" key={section.key}>
                <label
                  className="block text-sm font-medium"
                  htmlFor={`${id}-${section.key}`}
                >
                  {t(`sections.${section.key}`)}
                </label>
                {section.key === "currentStack" ? (
                  <div className="border-input dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 flex flex-wrap items-center gap-1.5 rounded-lg border bg-transparent px-2 py-1.5 transition-colors focus-within:ring-2">
                    {stack.map((tool) => (
                      <Badge
                        className="max-w-full gap-1 pr-0.5 font-normal"
                        variant="secondary"
                        key={tool}
                      >
                        <span className="min-w-0 wrap-anywhere">{tool}</span>
                        <button
                          type="button"
                          className="hover:bg-muted focus-visible:ring-ring flex size-6 shrink-0 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                          aria-label={t("removeTool", { tool })}
                          onClick={() => {
                            form.setFieldValue("currentStack", (items) =>
                              items.filter((item) => item !== tool)
                            );
                            stackInput.current?.focus();
                          }}
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      </Badge>
                    ))}
                    <input
                      ref={stackInput}
                      id={`${id}-${section.key}`}
                      className="placeholder:text-muted-foreground min-h-7 min-w-24 flex-1 bg-transparent px-1 text-base outline-none md:text-sm"
                      placeholder={t("addTool")}
                      maxLength={200}
                      value={stackDraft}
                      onChange={(event) => setStackDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (
                          event.key !== "Enter" ||
                          event.nativeEvent.isComposing
                        ) {
                          return;
                        }
                        event.preventDefault();
                        const tool = stackDraft.trim();
                        if (stack.includes(tool)) {
                          setStackDraft("");
                          return;
                        }
                        if (!tool) {
                          return;
                        }
                        if (stack.length >= 6) {
                          setError(t("stackLimit"));
                          return;
                        }
                        form.setFieldValue("currentStack", (items) => [
                          ...items,
                          tool,
                        ]);
                        setStackDraft("");
                        setError(null);
                      }}
                    />
                  </div>
                ) : (
                  <form.Field name={`sections.${section.key}`}>
                    {(field) => (
                      <Textarea
                        className="resize-none"
                        id={`${id}-${section.key}`}
                        name={section.key}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        rows={3}
                      />
                    )}
                  </form.Field>
                )}
              </div>
            ))}
          </div>
        </section>
        {persona.memories.length > 0 ? (
          <details className="group/memories border-t pt-6">
            <summary className="hover:bg-muted/50 focus-visible:ring-ring -mx-2 flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
              <span>{tGeoShared("memories")}</span>
              <span className="text-muted-foreground bg-muted rounded-md px-1.5 py-0.5 text-xs font-normal tabular-nums">
                {persona.memories.length}
              </span>
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                size={16}
                aria-hidden="true"
                className="text-muted-foreground ml-auto -rotate-90 group-open/memories:rotate-0"
              />
            </summary>
            <div className="space-y-6 pt-4">
              {groupPersonaMemories(persona.memories).map((group) => (
                <section className="space-y-2" key={group.kind}>
                  <h4 className="text-muted-foreground text-xs font-medium">
                    {group.kind === "background"
                      ? tLabels("background")
                      : t(`memoryKinds.${group.kind}`)}
                  </h4>
                  <ul className="bg-muted/20 divide-border/60 divide-y rounded-lg border px-3">
                    {group.memories.map((memory) => (
                      <li
                        className="py-3 text-[13px] leading-5 wrap-anywhere"
                        key={memory.id}
                      >
                        {memory.content}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </details>
        ) : null}
      </fieldset>
      <footer className="bg-background shrink-0 space-y-3 border-t px-6 py-4">
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={onCancel}
          >
            {tCommon("cancel")}
          </Button>
          <Button type="submit" disabled={isPending}>
            {submitLabel}
          </Button>
        </div>
      </footer>
    </form>
  );
}
