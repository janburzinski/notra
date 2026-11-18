"use client";

import { Label } from "@notra/ui/components/ui/label";
import { Switch } from "@notra/ui/components/ui/switch";
import { useTranslations } from "use-intl";

import type { OnboardingDomainInvitePrefProps } from "@/types/onboarding";

const ID = "onboarding-autoInviteDomain";

export function OnboardingDomainInvitePref({
  checked,
  disabled,
  domain,
  onCheckedChange,
}: OnboardingDomainInvitePrefProps) {
  const t = useTranslations("onboarding.domainInvite");

  return (
    <div className="grid min-w-0 gap-3">
      <Label htmlFor={ID}>{t("legend")}</Label>
      <label
        className="flex min-w-0 cursor-pointer items-center justify-between gap-3 text-sm has-data-disabled:cursor-not-allowed has-data-disabled:opacity-60"
        htmlFor={ID}
      >
        <span className="min-w-0">
          {t.rich("label", {
            domain,
            code: (chunks) => (
              <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
                {chunks}
              </code>
            ),
          })}
        </span>
        <Switch
          checked={checked}
          disabled={disabled}
          id={ID}
          onCheckedChange={onCheckedChange}
        />
      </label>
    </div>
  );
}
