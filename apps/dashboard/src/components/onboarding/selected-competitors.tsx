"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { CompetitorBrandLogo } from "@/components/onboarding/competitor-brand-logo";
import type { SelectedCompetitorsProps } from "@/types/onboarding";

export function SelectedCompetitors({
  competitors,
  disabled,
  onRemove,
}: SelectedCompetitorsProps) {
  const t = useTranslations("onboarding.competitors");
  const tCommon = useTranslations("common");
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">
        {t.rich("yourCompetitors", {
          count: competitors.length,
          muted: (chunks) => (
            <span className="text-muted-foreground text-xs font-normal">
              {chunks}
            </span>
          ),
        })}
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {competitors.map((entry) => (
          <li
            className="border-input flex items-center gap-1.5 rounded-full border py-1 pr-1 pl-1.5 text-sm"
            key={entry.id}
          >
            <CompetitorBrandLogo
              className="size-5 rounded-full"
              domain={entry.domain}
              logo={null}
              name={entry.name}
            />
            <span className="max-w-40 truncate">{entry.name}</span>
            <Button
              aria-label={tCommon("labels.removeName", { name: entry.name })}
              className="size-5 rounded-full"
              disabled={disabled}
              onClick={() => onRemove(entry)}
              size="icon-xs"
              type="button"
              variant="ghost-muted"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={12} />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
