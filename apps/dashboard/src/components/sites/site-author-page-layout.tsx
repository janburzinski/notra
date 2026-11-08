"use client";

import {
  RadioGroup,
  RadioGroupItem,
} from "@notra/ui/components/ui/radio-group";
import { cn } from "@notra/ui/lib/utils";
import { useId } from "react";
import { useTranslations } from "use-intl";

import { SITE_AUTHOR_PAGE_LAYOUTS } from "@/constants/site-authors";
import type {
  SiteAuthorLayoutSketchProps,
  SiteAuthorPageLayoutProps,
  SiteAuthorSketchLineProps,
} from "@/types/site-authors";

function Line({ className }: SiteAuthorSketchLineProps) {
  return (
    <span
      className={cn("bg-foreground/15 block h-1.5 rounded-full", className)}
    />
  );
}

/** A wireframe of the author page, so the two layouts can be told apart at a glance. */
function LayoutSketch({ layout }: SiteAuthorLayoutSketchProps) {
  const stacked = layout === "stacked";
  return (
    <span
      aria-hidden="true"
      className="bg-muted/50 flex h-36 flex-col rounded-lg border p-3"
    >
      <span
        className={cn(
          "flex gap-2",
          stacked ? "flex-col items-start" : "items-center"
        )}
      >
        <span
          className={cn(
            "bg-foreground/20 shrink-0 rounded-full",
            stacked ? "size-8" : "size-6"
          )}
        />
        <span className="space-y-1">
          <Line className="bg-foreground/30 w-16" />
          <Line className="w-10" />
        </span>
      </span>
      <span className="mt-2 space-y-1">
        <Line className="w-28" />
        <Line className="w-20" />
      </span>
      <span className="mt-2 flex gap-1">
        <span className="bg-foreground/15 size-2 rounded-full" />
        <span className="bg-foreground/15 size-2 rounded-full" />
        <span className="bg-foreground/15 size-2 rounded-full" />
      </span>
      <span className="mt-auto grid grid-cols-3 gap-1.5 border-t pt-2">
        <span className="bg-foreground/10 h-5 rounded" />
        <span className="bg-foreground/10 h-5 rounded" />
        <span className="bg-foreground/10 h-5 rounded" />
      </span>
    </span>
  );
}

export function SiteAuthorPageLayoutPicker({
  value,
  onChange,
}: SiteAuthorPageLayoutProps) {
  const t = useTranslations("sites.design.authors.pageLayout");
  const id = useId();
  return (
    <RadioGroup
      aria-label={t("title")}
      className="sm:grid-cols-2"
      onValueChange={(next) => {
        const layout = SITE_AUTHOR_PAGE_LAYOUTS.find((item) => item === next);
        if (layout) {
          onChange(layout);
        }
      }}
      value={value}
    >
      {SITE_AUTHOR_PAGE_LAYOUTS.map((layout) => (
        <label
          className="hover:bg-muted/30 has-[[data-checked]]:border-primary has-[[data-checked]]:ring-primary/15 has-focus-visible:ring-ring/50 flex cursor-pointer flex-col gap-3 rounded-xl border p-2.5 transition-colors has-focus-visible:ring-3 has-[[data-checked]]:ring-3"
          htmlFor={`${id}-${layout}`}
          key={layout}
        >
          <LayoutSketch layout={layout} />
          <span className="flex items-start gap-2.5 px-0.5 pb-0.5">
            <RadioGroupItem
              aria-describedby={`${id}-${layout}-description`}
              aria-labelledby={`${id}-${layout}-title`}
              className="mt-0.5"
              id={`${id}-${layout}`}
              value={layout}
            />
            <span className="min-w-0 space-y-0.5">
              <span
                className="block text-sm font-medium"
                id={`${id}-${layout}-title`}
              >
                {t(`layouts.${layout}.title`)}
              </span>
              <span
                className="text-muted-foreground block text-xs text-pretty"
                id={`${id}-${layout}-description`}
              >
                {t(`layouts.${layout}.description`)}
              </span>
            </span>
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}
