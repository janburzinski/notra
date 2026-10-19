import { useTranslations } from "use-intl";

import {
  EditorBox,
  EditorSection,
} from "@/components/automation/editor/editor-parts";
import { FormatPicker } from "@/components/automation/editor/format-picker";
import type { EventTriggerFormSectionProps } from "@/types/automation/event-trigger";

export function EventTriggerFormatSection({
  form,
}: EventTriggerFormSectionProps) {
  const t = useTranslations("automation.schedules.dialog");
  return (
    <EditorSection hint={t("contentFormatHint")} label={t("contentFormat")}>
      <EditorBox>
        <form.Field name="outputType">
          {(field) => (
            <FormatPicker
              onChange={field.handleChange}
              value={field.state.value}
            />
          )}
        </form.Field>
      </EditorBox>
    </EditorSection>
  );
}
