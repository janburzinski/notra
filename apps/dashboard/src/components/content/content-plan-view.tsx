"use client";

import { Add01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  GEO_BRIEF_MAX_CHECKLIST,
  GEO_BRIEF_MAX_CLAIMS,
  GEO_BRIEF_MAX_LINKS,
  GEO_BRIEF_MAX_QUESTIONS,
  GEO_BRIEF_MAX_SECTIONS,
  GEO_BRIEF_MAX_TITLE_LENGTH,
  GEO_BRIEF_MIN_SECTIONS,
} from "@notra/ai/constants/geo-writer";
import { geoContentBriefSchema } from "@notra/ai/schemas/geo-writer";
import type {
  GeoContentBrief,
  GeoContentSubtype,
} from "@notra/ai/types/geo-writer";
import { BLOG_POST_SUBTYPES } from "@notra/db/constants/content";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { Button } from "@/components/button";
import { PlanText } from "@/components/content/plan-text";
import {
  CONTENT_PLAN_HELPER,
  CONTENT_PLAN_SAVE_DEBOUNCE_MS,
} from "@/constants/content-plan";
import type {
  ContentPlanViewProps,
  KeyedContentPlan,
  KeyedPlanLine,
  KeyedPlanLink,
  KeyedPlanSection,
} from "@/types/content/plan";

function createPlanId(): string {
  return crypto.randomUUID();
}

function toLine(text: string): KeyedPlanLine {
  return { id: createPlanId(), text };
}

function toKeyedPlan(brief: GeoContentBrief): KeyedContentPlan {
  return {
    targetPrompt: brief.targetPrompt,
    intent: brief.intent,
    contentSubtype: brief.contentSubtype,
    workingTitle: brief.workingTitle,
    audience: brief.audience,
    jobToBeDone: brief.jobToBeDone,
    sections: brief.sections.map((section) => ({
      id: createPlanId(),
      heading: section.heading,
      goal: section.goal,
      claims: section.claims.map(toLine),
    })),
    questionsToAnswer: brief.questionsToAnswer.map(toLine),
    internalLinks: brief.internalLinks.map((link) => ({
      id: createPlanId(),
      ...link,
    })),
    acceptanceChecklist: brief.acceptanceChecklist.map(toLine),
  };
}

function fromKeyedPlan(draft: KeyedContentPlan): GeoContentBrief {
  return {
    targetPrompt: draft.targetPrompt,
    intent: draft.intent,
    contentSubtype: draft.contentSubtype,
    workingTitle: draft.workingTitle,
    audience: draft.audience,
    jobToBeDone: draft.jobToBeDone,
    sections: draft.sections.map((section) => ({
      heading: section.heading,
      goal: section.goal,
      claims: section.claims.map((claim) => claim.text),
    })),
    questionsToAnswer: draft.questionsToAnswer.map((question) => question.text),
    internalLinks: draft.internalLinks.map(({ url, anchor, why }) => ({
      url,
      anchor,
      why,
    })),
    acceptanceChecklist: draft.acceptanceChecklist.map((item) => item.text),
  };
}

function emptySection(): KeyedPlanSection {
  return { id: createPlanId(), heading: "", goal: "", claims: [] };
}

function emptyLink(): KeyedPlanLink {
  return { id: createPlanId(), url: "", anchor: "", why: "" };
}

function canonicalizeBrief(brief: GeoContentBrief): GeoContentBrief | null {
  const parsed = geoContentBriefSchema.safeParse(brief);
  return parsed.success ? parsed.data : null;
}

function briefsEqual(left: GeoContentBrief, right: GeoContentBrief): boolean {
  const canonicalLeft = canonicalizeBrief(left);
  const canonicalRight = canonicalizeBrief(right);
  if (!(canonicalLeft && canonicalRight)) {
    return false;
  }
  return JSON.stringify(canonicalLeft) === JSON.stringify(canonicalRight);
}

function isContentSubtype(value: string): value is GeoContentSubtype {
  return (BLOG_POST_SUBTYPES as readonly string[]).includes(value);
}

function formatSubtypeLabel(subtype: string): string {
  return subtype.charAt(0).toUpperCase() + subtype.slice(1);
}

function toSavableBrief(draft: KeyedContentPlan): GeoContentBrief | null {
  const parsed = geoContentBriefSchema.safeParse({
    ...fromKeyedPlan(draft),
    targetPrompt: draft.targetPrompt.trim(),
    intent: draft.intent.trim(),
    workingTitle: draft.workingTitle.trim(),
    audience: draft.audience.trim(),
    jobToBeDone: draft.jobToBeDone.trim(),
    sections: draft.sections
      .map((section) => ({
        heading: section.heading.trim(),
        goal: section.goal.trim(),
        claims: section.claims
          .map((claim) => claim.text.trim())
          .filter(Boolean),
      }))
      .filter((section) => section.heading && section.goal),
    questionsToAnswer: draft.questionsToAnswer
      .map((question) => question.text.trim())
      .filter(Boolean),
    internalLinks: draft.internalLinks.flatMap((link) => {
      const url = link.url.trim();
      const anchor = link.anchor.trim();
      const why = link.why.trim();
      if (!(url && anchor && why)) {
        return [];
      }
      return [{ url, anchor, why }];
    }),
    acceptanceChecklist: draft.acceptanceChecklist
      .map((item) => item.text.trim())
      .filter(Boolean),
  });
  return parsed.success ? parsed.data : null;
}

function replaceAt<T>(items: T[], index: number, value: T): T[] {
  return items.map((item, itemIndex) => (itemIndex === index ? value : item));
}

function removeAt<T>(items: T[], index: number): T[] {
  return items.filter((_, itemIndex) => itemIndex !== index);
}

function PlanField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground text-[0.6875rem] font-medium tracking-wide uppercase">
        {label}
      </p>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function AddItemButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      className="text-muted-foreground h-auto gap-1 px-1 py-1 text-xs font-medium"
      onClick={onClick}
      size="sm"
      type="button"
      variant="ghost"
    >
      <HugeiconsIcon className="size-3.5" icon={Add01Icon} />
      {label}
    </Button>
  );
}

function RemoveItemButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={label}
      className="text-muted-foreground size-7 shrink-0 opacity-0 group-focus-within/item:opacity-100 group-hover/item:opacity-100 focus-visible:opacity-100"
      onClick={onClick}
      size="sm"
      type="button"
      variant="ghost"
    >
      <HugeiconsIcon className="size-3.5" icon={Cancel01Icon} />
    </Button>
  );
}

export function ContentPlanView({
  brief,
  isWriting = false,
  onChange,
  onDirtyChange,
}: ContentPlanViewProps) {
  const readOnly = isWriting || !onChange;
  const [draft, setDraft] = useState(() => toKeyedPlan(brief));
  const briefRef = useRef(brief);

  const commit = (next = draft) => {
    const savable = toSavableBrief(next);
    if (!savable || !onChange) {
      return;
    }
    if (briefsEqual(savable, brief)) {
      return;
    }
    onChange(savable);
  };

  useEffect(() => {
    const previousServer = briefRef.current;
    setDraft((current) => {
      const currentPlain = fromKeyedPlan(current);
      if (briefsEqual(currentPlain, brief)) {
        return current;
      }
      if (briefsEqual(currentPlain, previousServer)) {
        return toKeyedPlan(brief);
      }
      const savable = toSavableBrief(current);
      if (savable && briefsEqual(savable, brief)) {
        return current;
      }
      return current;
    });
    briefRef.current = brief;
  }, [brief]);

  useEffect(() => {
    if (readOnly) {
      return;
    }
    const timer = window.setTimeout(() => {
      const savable = toSavableBrief(draft);
      if (!savable || !onChange) {
        return;
      }
      if (briefsEqual(savable, brief)) {
        return;
      }
      onChange(savable);
    }, CONTENT_PLAN_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [brief, draft, onChange, readOnly]);

  const savableDraft = toSavableBrief(draft);
  const isDirty = savableDraft === null || !briefsEqual(savableDraft, brief);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const update = (next: KeyedContentPlan) => {
    setDraft(next);
  };

  return (
    <div aria-busy={isWriting} className="mx-auto w-full max-w-3xl space-y-10">
      <header className="space-y-4">
        <div className="space-y-2">
          <p className="text-muted-foreground text-[0.6875rem] font-medium tracking-wide uppercase">
            Working title
          </p>
          <PlanText
            aria-label="Working title"
            className="text-3xl leading-tight font-semibold tracking-tight text-pretty md:text-4xl"
            maxLength={GEO_BRIEF_MAX_TITLE_LENGTH}
            onChange={(workingTitle) => update({ ...draft, workingTitle })}
            onCommit={() => commit()}
            placeholder="Working title"
            readOnly={readOnly}
            value={draft.workingTitle}
          />
        </div>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed text-pretty">
          {CONTENT_PLAN_HELPER}
        </p>
      </header>

      <section className="grid gap-6 sm:grid-cols-2">
        <PlanField label="Target prompt">
          <PlanText
            aria-label="Target prompt"
            onChange={(targetPrompt) => update({ ...draft, targetPrompt })}
            onCommit={() => commit()}
            placeholder="The question a buyer would ask"
            readOnly={readOnly}
            value={draft.targetPrompt}
          />
        </PlanField>
        <PlanField label="Intent">
          <PlanText
            aria-label="Intent"
            onChange={(intent) => update({ ...draft, intent })}
            onCommit={() => commit()}
            placeholder="Why someone is searching for this"
            readOnly={readOnly}
            value={draft.intent}
          />
        </PlanField>
        <PlanField label="Type">
          {readOnly ? (
            <p>Blog post ({draft.contentSubtype})</p>
          ) : (
            <Select
              onValueChange={(value) => {
                if (typeof value !== "string" || !isContentSubtype(value)) {
                  return;
                }
                const next = { ...draft, contentSubtype: value };
                update(next);
                commit(next);
              }}
              value={draft.contentSubtype}
            >
              <SelectTrigger
                aria-label="Content type"
                className="h-auto min-h-0 w-fit gap-1 border-0 bg-transparent p-0 shadow-none dark:bg-transparent dark:hover:bg-transparent"
                size="sm"
              >
                <SelectValue>
                  {(value) =>
                    typeof value === "string"
                      ? `Blog post (${value})`
                      : "Choose a type"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="start">
                {BLOG_POST_SUBTYPES.map((subtype) => (
                  <SelectItem key={subtype} value={subtype}>
                    {formatSubtypeLabel(subtype)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </PlanField>
        <PlanField label="Audience">
          <PlanText
            aria-label="Audience"
            onChange={(audience) => update({ ...draft, audience })}
            onCommit={() => commit()}
            placeholder="Who this is for"
            readOnly={readOnly}
            value={draft.audience}
          />
        </PlanField>
        <PlanField label="Job to be done">
          <PlanText
            aria-label="Job to be done"
            onChange={(jobToBeDone) => update({ ...draft, jobToBeDone })}
            onCommit={() => commit()}
            placeholder="What the article should help them do"
            readOnly={readOnly}
            value={draft.jobToBeDone}
          />
        </PlanField>
      </section>

      <section className="space-y-5">
        <h2 className="text-muted-foreground text-[0.6875rem] font-medium tracking-wide uppercase">
          Outline
        </h2>
        <div className="space-y-8">
          {draft.sections.map((section, index) => (
            <article className="flex gap-4" key={section.id}>
              <span
                aria-hidden="true"
                className="text-muted-foreground mt-0.5 w-6 shrink-0 font-mono text-xs leading-6"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="group/item flex items-start gap-1">
                  <PlanText
                    aria-label={`Section ${index + 1} heading`}
                    className="text-base leading-snug font-medium"
                    onChange={(heading) =>
                      update({
                        ...draft,
                        sections: replaceAt(draft.sections, index, {
                          ...section,
                          heading,
                        }),
                      })
                    }
                    onCommit={() => commit()}
                    placeholder="Section heading"
                    readOnly={readOnly}
                    value={section.heading}
                  />
                  {readOnly ||
                  draft.sections.length <= GEO_BRIEF_MIN_SECTIONS ? null : (
                    <RemoveItemButton
                      label={`Remove section ${index + 1}`}
                      onClick={() =>
                        update({
                          ...draft,
                          sections: removeAt(draft.sections, index),
                        })
                      }
                    />
                  )}
                </div>
                <PlanText
                  aria-label={`Section ${index + 1} goal`}
                  className="text-muted-foreground text-sm leading-relaxed"
                  onChange={(goal) =>
                    update({
                      ...draft,
                      sections: replaceAt(draft.sections, index, {
                        ...section,
                        goal,
                      }),
                    })
                  }
                  onCommit={() => commit()}
                  placeholder="What the reader should take away"
                  readOnly={readOnly}
                  value={section.goal}
                />
                <ul className="space-y-1.5">
                  {section.claims.map((claim, claimIndex) => (
                    <li className="group/item flex gap-2" key={claim.id}>
                      <span
                        aria-hidden="true"
                        className="bg-muted-foreground mt-2.5 size-1 shrink-0 rounded-full"
                      />
                      <PlanText
                        aria-label={`Section ${index + 1} point ${claimIndex + 1}`}
                        className="text-muted-foreground text-sm leading-relaxed"
                        onChange={(text) =>
                          update({
                            ...draft,
                            sections: replaceAt(draft.sections, index, {
                              ...section,
                              claims: replaceAt(section.claims, claimIndex, {
                                ...claim,
                                text,
                              }),
                            }),
                          })
                        }
                        onCommit={() => commit()}
                        placeholder="A claim this section must make"
                        readOnly={readOnly}
                        value={claim.text}
                      />
                      {readOnly ? null : (
                        <RemoveItemButton
                          label={`Remove point ${claimIndex + 1}`}
                          onClick={() =>
                            update({
                              ...draft,
                              sections: replaceAt(draft.sections, index, {
                                ...section,
                                claims: removeAt(section.claims, claimIndex),
                              }),
                            })
                          }
                        />
                      )}
                    </li>
                  ))}
                </ul>
                {readOnly ||
                section.claims.length >= GEO_BRIEF_MAX_CLAIMS ? null : (
                  <AddItemButton
                    label="Add point"
                    onClick={() =>
                      update({
                        ...draft,
                        sections: replaceAt(draft.sections, index, {
                          ...section,
                          claims: [...section.claims, toLine("")],
                        }),
                      })
                    }
                  />
                )}
              </div>
            </article>
          ))}
        </div>
        {readOnly || draft.sections.length >= GEO_BRIEF_MAX_SECTIONS ? null : (
          <AddItemButton
            label="Add section"
            onClick={() =>
              update({
                ...draft,
                sections: [...draft.sections, emptySection()],
              })
            }
          />
        )}
      </section>

      <section className="grid gap-8 sm:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-muted-foreground text-[0.6875rem] font-medium tracking-wide uppercase">
            FAQ
          </h2>
          <ul className="space-y-1.5">
            {draft.questionsToAnswer.map((question, index) => (
              <li className="group/item flex gap-1" key={question.id}>
                <PlanText
                  aria-label={`FAQ ${index + 1}`}
                  className="text-sm leading-relaxed"
                  onChange={(text) =>
                    update({
                      ...draft,
                      questionsToAnswer: replaceAt(
                        draft.questionsToAnswer,
                        index,
                        { ...question, text }
                      ),
                    })
                  }
                  onCommit={() => commit()}
                  placeholder="A question the article should answer"
                  readOnly={readOnly}
                  value={question.text}
                />
                {readOnly ? null : (
                  <RemoveItemButton
                    label={`Remove question ${index + 1}`}
                    onClick={() =>
                      update({
                        ...draft,
                        questionsToAnswer: removeAt(
                          draft.questionsToAnswer,
                          index
                        ),
                      })
                    }
                  />
                )}
              </li>
            ))}
          </ul>
          {readOnly ||
          draft.questionsToAnswer.length >= GEO_BRIEF_MAX_QUESTIONS ? null : (
            <AddItemButton
              label="Add question"
              onClick={() =>
                update({
                  ...draft,
                  questionsToAnswer: [...draft.questionsToAnswer, toLine("")],
                })
              }
            />
          )}
        </div>
        <div className="space-y-3">
          <h2 className="text-muted-foreground text-[0.6875rem] font-medium tracking-wide uppercase">
            Acceptance checklist
          </h2>
          <ul className="space-y-1.5">
            {draft.acceptanceChecklist.map((item, index) => (
              <li className="group/item flex gap-1" key={item.id}>
                <PlanText
                  aria-label={`Checklist item ${index + 1}`}
                  className="text-sm leading-relaxed"
                  onChange={(text) =>
                    update({
                      ...draft,
                      acceptanceChecklist: replaceAt(
                        draft.acceptanceChecklist,
                        index,
                        { ...item, text }
                      ),
                    })
                  }
                  onCommit={() => commit()}
                  placeholder="A check the finished article must pass"
                  readOnly={readOnly}
                  value={item.text}
                />
                {readOnly ? null : (
                  <RemoveItemButton
                    label={`Remove check ${index + 1}`}
                    onClick={() =>
                      update({
                        ...draft,
                        acceptanceChecklist: removeAt(
                          draft.acceptanceChecklist,
                          index
                        ),
                      })
                    }
                  />
                )}
              </li>
            ))}
          </ul>
          {readOnly ||
          draft.acceptanceChecklist.length >= GEO_BRIEF_MAX_CHECKLIST ? null : (
            <AddItemButton
              label="Add check"
              onClick={() =>
                update({
                  ...draft,
                  acceptanceChecklist: [
                    ...draft.acceptanceChecklist,
                    toLine(""),
                  ],
                })
              }
            />
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-[0.6875rem] font-medium tracking-wide uppercase">
          Internal links
        </h2>
        <ul className="space-y-4">
          {draft.internalLinks.map((link, index) => (
            <li className="group/item space-y-1.5" key={link.id}>
              <div className="group/item flex items-start gap-1">
                <PlanText
                  aria-label={`Internal link ${index + 1} anchor`}
                  className="text-sm font-medium"
                  onChange={(anchor) =>
                    update({
                      ...draft,
                      internalLinks: replaceAt(draft.internalLinks, index, {
                        ...link,
                        anchor,
                      }),
                    })
                  }
                  onCommit={() => commit()}
                  placeholder="Anchor text"
                  readOnly={readOnly}
                  value={link.anchor}
                />
                {readOnly ? null : (
                  <RemoveItemButton
                    label={`Remove link ${index + 1}`}
                    onClick={() =>
                      update({
                        ...draft,
                        internalLinks: removeAt(draft.internalLinks, index),
                      })
                    }
                  />
                )}
              </div>
              <PlanText
                aria-label={`Internal link ${index + 1} URL`}
                className="text-muted-foreground text-sm"
                onChange={(url) =>
                  update({
                    ...draft,
                    internalLinks: replaceAt(draft.internalLinks, index, {
                      ...link,
                      url,
                    }),
                  })
                }
                onCommit={() => commit()}
                placeholder="https://"
                readOnly={readOnly}
                value={link.url}
              />
              <PlanText
                aria-label={`Internal link ${index + 1} reason`}
                className="text-muted-foreground text-sm leading-relaxed"
                onChange={(why) =>
                  update({
                    ...draft,
                    internalLinks: replaceAt(draft.internalLinks, index, {
                      ...link,
                      why,
                    }),
                  })
                }
                onCommit={() => commit()}
                placeholder="Why this page belongs in the article"
                readOnly={readOnly}
                value={link.why}
              />
            </li>
          ))}
        </ul>
        {readOnly ||
        draft.internalLinks.length >= GEO_BRIEF_MAX_LINKS ? null : (
          <AddItemButton
            label="Add link"
            onClick={() =>
              update({
                ...draft,
                internalLinks: [...draft.internalLinks, emptyLink()],
              })
            }
          />
        )}
      </section>
    </div>
  );
}
