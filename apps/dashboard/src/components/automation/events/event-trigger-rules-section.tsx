import { useStore } from "@tanstack/react-form";
import { useTranslations } from "use-intl";

import {
  EditorBox,
  EditorPad,
  EditorSection,
} from "@/components/automation/editor/editor-parts";
import { BrandIdentityRadioGroup } from "@/components/brand-identity-radio-group";
import { OUTPUT_TYPE_LABEL_KEYS } from "@/constants/automation-output-types";
import { supportsAutoPublish } from "@/constants/schedule-output-types";
import type { EventTriggerRulesSectionProps } from "@/types/automation/event-trigger";

import { TriggerSwitchRow } from "./trigger-switch-row";

export function EventTriggerRulesSection({
  form,
  brandVoices,
}: EventTriggerRulesSectionProps) {
  const t = useTranslations("automation.events.dialog");
  const tSchedules = useTranslations("automation.schedules");
  const tCommon = useTranslations("common");
  const outputType = useStore(form.store, (s) => s.values.outputType);

  const nonDefaultBrandVoices = brandVoices.filter((voice) => !voice.isDefault);
  const defaultBrandVoice = brandVoices.find((voice) => voice.isDefault);
  const defaultBrandVoiceLabel = defaultBrandVoice
    ? tSchedules("dialog.defaultVoiceName", { name: defaultBrandVoice.name })
    : tSchedules("dialog.defaultVoice");

  if (!(brandVoices.length > 1 || supportsAutoPublish(outputType))) {
    return null;
  }

  return (
    <EditorSection
      hint={t("rulesHint")}
      label={tSchedules("dialog.rules", {
        type: tCommon(`labels.${OUTPUT_TYPE_LABEL_KEYS[outputType]}`),
      })}
    >
      <EditorBox>
        {brandVoices.length > 1 && (
          <EditorPad>
            <form.Field name="brandVoiceId">
              {(field) => (
                <BrandIdentityRadioGroup
                  description={tSchedules("dialog.brandVoiceDescription")}
                  emptyOption={{
                    label: defaultBrandVoiceLabel,
                    description: tSchedules(
                      "dialog.brandVoiceDefaultDescription"
                    ),
                    voice: defaultBrandVoice,
                  }}
                  id={field.name}
                  label={tCommon("labels.brandVoice")}
                  onChange={field.handleChange}
                  value={field.state.value}
                  voices={nonDefaultBrandVoices}
                />
              )}
            </form.Field>
          </EditorPad>
        )}
        {supportsAutoPublish(outputType) && (
          <form.Field name="autoPublish">
            {(field) => (
              <TriggerSwitchRow
                checked={field.state.value}
                id={field.name}
                label={tSchedules("dialog.autoPublish")}
                onCheckedChange={field.handleChange}
                tooltip={tSchedules("dialog.autoPublishHint")}
              />
            )}
          </form.Field>
        )}
      </EditorBox>
    </EditorSection>
  );
}
