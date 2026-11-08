"use client";

import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import { useId } from "react";
import { useTranslations } from "use-intl";

import type { ImportHostFieldProps } from "@/types/components/analytics-import";

export function ImportHostField({ value, onChange }: ImportHostFieldProps) {
  const t = useTranslations("geo.analyticsImport.source");
  const id = useId();
  const hintId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{t("hostLabel")}</Label>
      <Input
        aria-describedby={hintId}
        autoComplete="off"
        id={id}
        inputMode="url"
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        value={value}
      />
      <p className="text-muted-foreground text-xs" id={hintId}>
        {t("hostHint")}
      </p>
    </div>
  );
}
