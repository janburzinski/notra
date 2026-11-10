"use client";

import { PlayIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@notra/ui/components/ui/button";
import { Label } from "@notra/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { Slider } from "@notra/ui/components/ui/slider";
import { Switch } from "@notra/ui/components/ui/switch";
import { TitleCard } from "@notra/ui/components/ui/title-card";
import { useTranslations } from "use-intl";

import { UI_SOUND_CATEGORIES, UI_SOUND_VARIANTS } from "@/constants/ui-sounds";
import { useUiSoundSettings } from "@/lib/hooks/use-ui-sound-settings";
import { previewUiSound, previewUiSoundVariant } from "@/lib/ui-sounds/player";
import { updateUiSoundSettings } from "@/lib/ui-sounds/store";
import type { UiSoundCategory, UiSoundChoice } from "@/types/ui-sounds";

const VOLUME_LABEL_ID = "ui-sounds-volume";

function setEnabled(enabled: boolean) {
  updateUiSoundSettings((current) => ({ ...current, enabled }));
  // The listeners only start after this click, so it confirms itself.
  if (enabled) {
    previewUiSound("toggleOn");
  }
}

function setVolume(value: number | readonly number[]) {
  const volume = typeof value === "number" ? value : value[0];
  if (volume !== undefined) {
    updateUiSoundSettings((current) => ({ ...current, volume }));
  }
}

function SoundRow({
  category,
  choice,
}: {
  category: UiSoundCategory;
  choice: UiSoundChoice;
}) {
  const t = useTranslations("settings.sounds");
  const id = `ui-sound-${category}`;
  const variantLabel = (variant: string) =>
    t(`variants.${category}.${variant}` as "variants.click.tap");
  const items = [
    ...UI_SOUND_VARIANTS[category].map((variant) => ({
      label: variantLabel(variant),
      value: variant,
    })),
    { label: t("off"), value: "off" },
  ];
  const selected = items.find((item) => item.value === choice);

  const preview = (next: string) => {
    if (next !== "off") {
      previewUiSoundVariant(category, next);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 space-y-1">
        <Label htmlFor={id}>{t(`categories.${category}.label`)}</Label>
        <p className="text-muted-foreground text-xs">
          {t(`categories.${category}.description`)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Select
          items={items}
          onValueChange={(next) => {
            if (typeof next !== "string") {
              return;
            }
            updateUiSoundSettings((current) => ({
              ...current,
              variants: { ...current.variants, [category]: next },
            }));
            preview(next);
          }}
          value={choice}
        >
          <SelectTrigger className="min-w-32" id={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          aria-label={t("preview", { sound: selected?.label ?? choice })}
          disabled={choice === "off"}
          onClick={() => preview(choice)}
          size="icon-sm"
          variant="ghost"
        >
          <HugeiconsIcon aria-hidden="true" icon={PlayIcon} strokeWidth={2} />
        </Button>
      </div>
    </div>
  );
}

export function SoundsSection() {
  const t = useTranslations("settings.sounds");
  const settings = useUiSoundSettings();

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
          checked={settings.enabled}
          id="ui-sounds-enabled"
          onCheckedChange={setEnabled}
        />
      </div>
      {settings.enabled ? (
        <div className="mt-4 space-y-4 border-t pt-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium" id={VOLUME_LABEL_ID}>
              {t("volume")}
            </span>
            <Slider
              aria-labelledby={VOLUME_LABEL_ID}
              className="w-40"
              max={100}
              min={0}
              onValueChange={setVolume}
              step={5}
              value={settings.volume}
            />
          </div>
          <div className="divide-y border-t pt-3">
            {UI_SOUND_CATEGORIES.map((category) => (
              <SoundRow
                category={category}
                choice={settings.variants[category]}
                key={category}
              />
            ))}
          </div>
        </div>
      ) : null}
    </TitleCard>
  );
}
