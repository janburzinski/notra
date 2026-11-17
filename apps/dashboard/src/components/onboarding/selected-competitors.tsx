"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@notra/ui/components/ui/badge";
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
      {competitors.length === 0 ? (
        <p className="text-muted-foreground text-xs leading-5">
          {t("noneSelected")}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {competitors.map((entry) => (
            <li className="flex" key={entry.id}>
              <Badge className="gap-1 pr-1" shape="rounded" variant="secondary">
                <CompetitorBrandLogo
                  className="size-3.5 rounded-xs"
                  domain={entry.domain}
                  logo={null}
                  name={entry.name}
                />
                <span className="max-w-40 truncate">{entry.name}</span>
                <Button
                  aria-label={tCommon("labels.removeName", {
                    name: entry.name,
                  })}
                  className="hover:bg-background size-4 rounded-sm"
                  disabled={disabled}
                  onClick={() => onRemove(entry)}
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={12} />
                </Button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
