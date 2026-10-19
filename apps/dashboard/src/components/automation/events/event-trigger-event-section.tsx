import { useStore } from "@tanstack/react-form";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";

import {
  EditorBox,
  EditorPad,
  EditorSection,
} from "@/components/automation/editor/editor-parts";
import { EVENT_TYPE_ORDER } from "@/constants/event-triggers";
import type { EventTriggerFormSectionProps } from "@/types/automation/event-trigger";

import { EventTypeCard } from "./event-type-card";
import { IgnoreCommitPatternsField } from "./ignore-commit-patterns-field";
import { TriggerSwitchRow } from "./trigger-switch-row";

export function EventTriggerEventSection({
  form,
  kindPicker,
}: EventTriggerFormSectionProps & { kindPicker?: ReactNode }) {
  const t = useTranslations("automation.events.dialog");
  const eventType = useStore(form.store, (s) => s.values.eventType);

  return (
    <EditorSection hint={t("triggerEventHint")} label={t("triggerEvent")}>
      <EditorBox>
        <form.Field name="eventType">
          {(field) => (
            <>
              {EVENT_TYPE_ORDER.map((type) => (
                <EventTypeCard
                  eventType={type}
                  key={type}
                  onSelect={() => field.handleChange(type)}
                  selected={field.state.value === type}
                />
              ))}
            </>
          )}
        </form.Field>
        {eventType === "push" && (
          <EditorPad>
            <form.Field name="ignoreCommitPatternsText">
              {(field) => (
                <IgnoreCommitPatternsField
                  errors={field.state.meta.errors}
                  fieldName={field.name}
                  onBlur={field.handleBlur}
                  onChange={field.handleChange}
                  value={field.state.value}
                />
              )}
            </form.Field>
          </EditorPad>
        )}
        {eventType === "release" && (
          <form.Field name="includePreReleases">
            {(field) => (
              <TriggerSwitchRow
                checked={field.state.value}
                id={field.name}
                label={t("includePreReleases")}
                onCheckedChange={field.handleChange}
                tooltip={t("includePreReleasesHint")}
              />
            )}
          </form.Field>
        )}
        {kindPicker}
      </EditorBox>
    </EditorSection>
  );
}
