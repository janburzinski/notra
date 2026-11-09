"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "use-intl";

import { ANALYTICS_IMPORT_PROVIDER_ORDER } from "@/constants/analytics-imports";
import type { ImportProviderPickerProps } from "@/types/components/analytics-import";

import { ImportFrame } from "./import-frame";
import { ImportProviderMark } from "./import-provider-mark";

export function ImportProviderPicker({ onPick }: ImportProviderPickerProps) {
  const t = useTranslations("geo.analyticsImport.providers");
  return (
    <ImportFrame title={t("title")}>
      <ul className="divide-table-row-border divide-y">
        {ANALYTICS_IMPORT_PROVIDER_ORDER.map((provider) => (
          <li className="group/row" key={provider}>
            <button
              className="group/provider hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-ring/50 flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors duration-150 outline-none group-first/row:rounded-t-xl group-last/row:rounded-b-xl focus-visible:ring-3 focus-visible:ring-inset"
              onClick={() => onPick(provider)}
              type="button"
            >
              <ImportProviderMark provider={provider} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium">
                  {t(`${provider}.name`)}
                </span>
                <span className="text-muted-foreground text-xs text-pretty">
                  {t(`${provider}.description`)}
                </span>
              </span>
              <HugeiconsIcon
                aria-hidden="true"
                className="text-muted-foreground group-hover/provider:text-foreground size-4 shrink-0 transition-colors duration-150"
                icon={ArrowRight01Icon}
              />
            </button>
          </li>
        ))}
      </ul>
    </ImportFrame>
  );
}
