"use client";

import { Label } from "@notra/ui/components/ui/label";
import { Switch } from "@notra/ui/components/ui/switch";
import { TitleCard } from "@notra/ui/components/ui/title-card";
import { useTranslations } from "use-intl";

import { useUiSoundsEnabled } from "@/lib/hooks/use-ui-sounds-enabled";
import { previewUiSound } from "@/lib/ui-sounds/player";
import { setUiSoundsEnabled } from "@/lib/ui-sounds/store";

function setEnabled(enabled: boolean) {
  setUiSoundsEnabled(enabled);
  // The listeners only start after this click, so it confirms itself.
  if (enabled) {
    previewUiSound("toggleOn");
  }
}

export function SoundsSection() {
  const t = useTranslations("settings.sounds");
  const enabled = useUiSoundsEnabled();

  return (
    <TitleCard heading={t("heading")}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <Label className="cursor-pointer" htmlFor="ui-sounds-enabled">
            {t("enable")}
          </Label>
          <p className="text-muted-foreground text-xs">
            {t("enableDescription")}
          </p>
        </div>
        <Switch
          checked={enabled}
          id="ui-sounds-enabled"
          onCheckedChange={setEnabled}
        />
      </div>
    </TitleCard>
  );
}
