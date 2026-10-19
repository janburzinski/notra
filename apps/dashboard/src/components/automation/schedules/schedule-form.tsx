"use client";

import { AlertCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { CUSTOM_SCHEDULE_DEFAULT_INTERVAL_DAYS } from "@notra/ai/constants/schedule-interval";
import { toUtcDateString } from "@notra/ai/utils/schedule-interval";
import type { ScheduleFormValues } from "@notra/schemas/dashboard/automation/schedule-form";
import {
  LOOKBACK_WINDOWS,
  type LookbackWindow,
  MAX_SCHEDULE_INSTRUCTIONS_LENGTH,
  MAX_SCHEDULE_NAME_LENGTH,
} from "@notra/schemas/dashboard/integrations";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  useComboboxAnchor,
} from "@notra/ui/components/ui/combobox";
import { Label } from "@notra/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { Github } from "@notra/ui/components/ui/svgs/github";
import { Linear } from "@notra/ui/components/ui/svgs/linear";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import {
  EditorBox,
  EditorFooter,
  EditorRow,
  EditorHeader,
  EditorPad,
  EditorSection,
} from "@/components/automation/editor/editor-parts";
import { FormatPicker } from "@/components/automation/editor/format-picker";
import { TriggerSwitchRow } from "@/components/automation/events/trigger-switch-row";
import { BrandIdentityRadioGroup } from "@/components/brand-identity-radio-group";
import { Button } from "@/components/button";
import { AddRepositoryButton } from "@/components/integrations/add-repository-button";
import { AddRepositoryDialog } from "@/components/integrations/add-repository-dialog";
import { LegacyAddIntegrationDialog as AddIntegrationDialog } from "@/components/integrations/legacy/add-integration-dialog";
import { OUTPUT_TYPE_LABEL_KEYS } from "@/constants/automation-output-types";
import { LOOKBACK_WINDOW_COMMON_LABEL_KEYS } from "@/constants/schedule";
import { supportsAutoPublish } from "@/constants/schedule-output-types";
import { dashboardOrpc } from "@/lib/orpc/query";
import { createScheduleFormSchema } from "@/schemas/schedule-form";
import type {
  ScheduleFormProps,
  ScheduleCron,
  ScheduleIntegrationOption,
} from "@/types/automation/schedule";
import type { Trigger } from "@/types/triggers/triggers";
import { getOrpcErrorDataCode } from "@/utils/orpc-errors";
import {
  buildAutoScheduleName,
  getDefaultScheduleValues,
} from "@/utils/schedule-form";

import { ScheduleTriggerRow } from "./schedule-trigger-row";

export function ScheduleForm({
  organizationId,
  onSuccess,
  editTrigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  presetId,
  kindPicker,
}: ScheduleFormProps) {
  const t = useTranslations("automation.schedules");
  const tAutomationShared = useTranslations("automation.shared");
  const tValidation = useTranslations("automation.schedules.validation");
  const tCommon = useTranslations("common");
  const lookbackLabel = (window: LookbackWindow) =>
    window === "current_day"
      ? t("lookbackWindows.current_day")
      : tCommon(`labels.${LOOKBACK_WINDOW_COMMON_LABEL_KEYS[window]}`);
  const scheduleFormSchema = useMemo(
    () => createScheduleFormSchema(tValidation),
    [tValidation]
  );
  const isEditMode = !!editTrigger;
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (isControlled) {
        controlledOnOpenChange?.(next);
      } else {
        setInternalOpen(next);
      }
    },
    [controlledOnOpenChange, isControlled]
  );

  const [addRepoOpen, setAddRepoOpen] = useState(false);
  const [enabled, setEnabled] = useState(editTrigger?.enabled ?? true);
  const comboboxAnchor = useComboboxAnchor();

  const mutation = useMutation<{ trigger: Trigger }, Error, ScheduleFormValues>(
    {
      mutationFn: async (value) => {
        const githubRepoIds = value.repositoryIds.filter(
          (id) => !id.startsWith("linear:")
        );

        const instructions = value.instructions.trim();
        const schedulePayload = {
          organizationId,
          name: value.name.trim(),
          sourceType: "cron" as const,
          sourceConfig: { cron: value.schedule },
          targets: {
            repositoryIds: githubRepoIds,
            linearIntegrationIds: value.repositoryIds
              .filter((id) => id.startsWith("linear:"))
              .map((id) => id.slice("linear:".length)),
          },
          outputType: value.outputType,
          outputConfig: {
            ...(value.brandVoiceId ? { brandVoiceId: value.brandVoiceId } : {}),
            ...(instructions ? { instructions } : {}),
          },
          enabled,
          autoPublish: supportsAutoPublish(value.outputType)
            ? value.autoPublish
            : false,
          lookbackWindow: value.lookbackWindow,
        };

        try {
          if (isEditMode) {
            return await dashboardOrpc.automation.schedules.update.call({
              triggerId: editTrigger.id,
              ...schedulePayload,
            });
          }
          return await dashboardOrpc.automation.schedules.create.call(
            schedulePayload
          );
        } catch (error) {
          if (getOrpcErrorDataCode(error) === "DUPLICATE_TRIGGER") {
            throw new Error(t("dialog.alreadyExists"));
          }
          if (error instanceof Error && error.message) {
            throw error;
          }
          throw new Error(
            isEditMode
              ? tAutomationShared("failedToUpdateSchedule")
              : t("dialog.createFailed")
          );
        }
      },
      onSuccess: (data) => {
        toast.success(isEditMode ? t("dialog.updated") : t("dialog.added"));
        onSuccess?.(data.trigger);
        setOpen(false);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }
  );

  const form = useForm({
    defaultValues: getDefaultScheduleValues(editTrigger, presetId),
    validators: {
      onSubmit: scheduleFormSchema,
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  const previousAutoNameRef = useRef("");

  useEffect(() => {
    if (open) {
      form.reset(getDefaultScheduleValues(editTrigger, presetId));
      previousAutoNameRef.current = "";
    }
  }, [open, editTrigger, presetId, form]);

  const outputType = useStore(form.store, (s) => s.values.outputType);
  const schedule = useStore(form.store, (s) => s.values.schedule);
  const { frequency, intervalDays } = schedule;

  useEffect(() => {
    const newAutoName = buildAutoScheduleName(
      { frequency, intervalDays },
      outputType,
      t
    );
    const currentName = form.state.values.name;
    if (
      currentName === previousAutoNameRef.current ||
      currentName.length === 0
    ) {
      form.setFieldValue("name", newAutoName);
    }
    previousAutoNameRef.current = newAutoName;
  }, [outputType, frequency, intervalDays, form, t]);

  const { data: integrationsResponse, isLoading: isLoadingRepos } = useQuery(
    dashboardOrpc.integrations.list.queryOptions({
      input: { organizationId },
      enabled: !!organizationId && open,
    })
  );

  const { data: brandResponse } = useQuery(
    dashboardOrpc.brand.voices.list.queryOptions({
      input: { organizationId },
      enabled: !!organizationId && open,
    })
  );

  const brandVoices = brandResponse?.voices ?? [];
  const nonDefaultBrandVoices = brandVoices.filter((voice) => !voice.isDefault);
  const defaultBrandVoice = brandVoices.find((voice) => voice.isDefault);
  const defaultBrandVoiceLabel = defaultBrandVoice
    ? t("dialog.defaultVoiceName", { name: defaultBrandVoice.name })
    : t("dialog.defaultVoice");

  const { integrationOptions, githubIntegrationId } = useMemo(() => {
    const githubIntegrations =
      integrationsResponse?.integrations.filter(
        (i) => i.type === "github" && i.enabled
      ) ?? [];
    const linearIntegrations =
      integrationsResponse?.integrations.filter(
        (i) => i.type === "linear" && i.enabled
      ) ?? [];
    const repos = githubIntegrations.flatMap((i) =>
      i.repositories.filter((r) => r.enabled)
    );

    const options: ScheduleIntegrationOption[] = [
      ...repos.map((r) => ({
        value: r.id,
        label: r.defaultBranch
          ? `${r.owner}/${r.repo} · ${r.defaultBranch}`
          : `${r.owner}/${r.repo}`,
        type: "github" as const,
      })),
      ...linearIntegrations.map((i) => ({
        value: `linear:${i.id}`,
        label: i.displayName,
        type: "linear" as const,
      })),
    ];

    return {
      integrationOptions: options,
      githubIntegrationId: githubIntegrations[0]?.id,
    };
  }, [integrationsResponse]);

  const handleFrequencyChange = (next: ScheduleCron["frequency"]) => {
    const prev = form.state.values.schedule;
    let dayOfWeek: number | undefined;
    let dayOfMonth: number | undefined;
    let intervalDays: number | undefined;
    let anchorDate: string | undefined;
    if (next === "weekly") {
      dayOfWeek = prev.dayOfWeek ?? 1;
    } else if (next === "monthly") {
      dayOfMonth = prev.dayOfMonth ?? 1;
    } else if (next === "custom") {
      intervalDays = prev.intervalDays ?? CUSTOM_SCHEDULE_DEFAULT_INTERVAL_DAYS;
      anchorDate = prev.anchorDate ?? toUtcDateString(new Date());
    }
    form.setFieldValue("schedule", {
      ...prev,
      frequency: next,
      dayOfWeek,
      dayOfMonth,
      intervalDays,
      anchorDate,
    });
  };

  const formError = useStore(form.store, (state) => {
    if (state.submissionAttempts === 0) {
      return null;
    }
    for (const meta of Object.values(state.fieldMeta)) {
      const errors = meta?.errors;
      if (errors && errors.length > 0) {
        const first = errors[0];
        if (typeof first === "string") {
          return first;
        }
        if (first && typeof first === "object" && "message" in first) {
          const message = (first as { message: unknown }).message;
          if (typeof message === "string") {
            return message;
          }
        }
      }
    }
    return null;
  });

  return (
    <>
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit();
        }}
      >
        <form.Field name="name">
          {(field) => (
            <EditorHeader
              enabled={enabled}
              kind="schedule"
              maxLength={MAX_SCHEDULE_NAME_LENGTH}
              name={field.state.value}
              onEnabledChange={setEnabled}
              onNameChange={field.handleChange}
              placeholder={buildAutoScheduleName(
                { frequency, intervalDays },
                outputType,
                t
              )}
            />
          )}
        </form.Field>

        <EditorSection
          hint={t("dialog.scheduleHint")}
          label={tCommon("labels.schedule")}
        >
          <EditorBox>
            <EditorPad>
              <ScheduleTriggerRow
                onDayOfMonthChange={(day) =>
                  form.setFieldValue("schedule.dayOfMonth", day)
                }
                onDayOfWeekChange={(day) =>
                  form.setFieldValue("schedule.dayOfWeek", day)
                }
                onFrequencyChange={handleFrequencyChange}
                onIntervalDaysChange={(days) =>
                  form.setFieldValue("schedule.intervalDays", days)
                }
                onTimeChange={(nextHour, nextMinute) => {
                  form.setFieldValue("schedule.hour", nextHour);
                  form.setFieldValue("schedule.minute", nextMinute);
                }}
                schedule={schedule}
              />
            </EditorPad>
            {kindPicker}
          </EditorBox>
        </EditorSection>

        <EditorSection
          hint={t("dialog.instructionsHint")}
          label={t("dialog.instructions")}
        >
          <EditorBox>
            <EditorPad>
              <form.Field name="instructions">
                {(field) => (
                  <div className="space-y-2">
                    <textarea
                      aria-label={t("dialog.instructions")}
                      className="placeholder:text-muted-foreground/70 max-h-80 min-h-16 w-full resize-none overflow-y-auto bg-transparent text-sm outline-none"
                      id={field.name}
                      maxLength={MAX_SCHEDULE_INSTRUCTIONS_LENGTH}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                      }}
                      placeholder={t("dialog.instructionsPlaceholder")}
                      value={field.state.value}
                    />
                    <div className="text-muted-foreground flex items-center justify-between text-xs">
                      <span>{t("dialog.instructionsFooter")}</span>
                      <span className="tabular-nums">
                        {field.state.value.length} /{" "}
                        {MAX_SCHEDULE_INSTRUCTIONS_LENGTH}
                      </span>
                    </div>
                  </div>
                )}
              </form.Field>
            </EditorPad>
          </EditorBox>
        </EditorSection>

        <EditorSection
          hint={t("dialog.contentFormatHint")}
          label={t("dialog.contentFormat")}
        >
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

        <EditorSection
          hint={t("dialog.sourcesHint")}
          label={tCommon("labels.sources")}
        >
          <EditorBox>
            {!isLoadingRepos && integrationOptions.length === 0 ? (
              <EditorRow
                action={
                  <AddRepositoryButton
                    onAdd={() => {
                      setAddRepoOpen(true);
                    }}
                  />
                }
              >
                {tCommon("labels.noIntegrationsConnectedYet")}
              </EditorRow>
            ) : (
              <EditorPad>
                {isLoadingRepos && <Skeleton className="h-10 w-full" />}
                {!isLoadingRepos && integrationOptions.length > 0 && (
                  <form.Field name="repositoryIds">
                    {(field) => (
                      <div ref={comboboxAnchor}>
                        <Combobox
                          items={integrationOptions.map((o) => o.value)}
                          multiple
                          onValueChange={(value) =>
                            field.handleChange(
                              Array.isArray(value) ? value : []
                            )
                          }
                          value={field.state.value}
                        >
                          <ComboboxChips>
                            {field.state.value.map((id) => {
                              const opt = integrationOptions.find(
                                (o) => o.value === id
                              );
                              if (!opt) {
                                return null;
                              }
                              return (
                                <ComboboxChip
                                  className="max-w-full"
                                  key={opt.value}
                                >
                                  <span className="flex min-w-0 items-center gap-1.5">
                                    {opt.type === "github" ? (
                                      <Github className="size-3 shrink-0" />
                                    ) : (
                                      <Linear className="size-3 shrink-0" />
                                    )}
                                    <span
                                      className="truncate"
                                      title={opt.label}
                                    >
                                      {opt.label}
                                    </span>
                                  </span>
                                </ComboboxChip>
                              );
                            })}
                            <ComboboxChipsInput
                              placeholder={t("dialog.searchIntegrations")}
                            />
                            <ComboboxTrigger className="ml-auto flex shrink-0 items-center self-center" />
                          </ComboboxChips>
                          <ComboboxContent anchor={comboboxAnchor.current}>
                            <ComboboxEmpty>
                              {t("dialog.noIntegrationsFound")}
                            </ComboboxEmpty>
                            <ComboboxList>
                              {integrationOptions.map((opt) => (
                                <ComboboxItem key={opt.value} value={opt.value}>
                                  <span className="flex min-w-0 items-center gap-2">
                                    {opt.type === "github" ? (
                                      <Github className="size-3.5 shrink-0" />
                                    ) : (
                                      <Linear className="size-3.5 shrink-0" />
                                    )}
                                    <span
                                      className="truncate"
                                      title={opt.label}
                                    >
                                      {opt.label}
                                    </span>
                                  </span>
                                </ComboboxItem>
                              ))}
                            </ComboboxList>
                          </ComboboxContent>
                        </Combobox>
                      </div>
                    )}
                  </form.Field>
                )}
              </EditorPad>
            )}
          </EditorBox>
        </EditorSection>

        <EditorSection
          hint={t("dialog.rulesHint")}
          label={t("dialog.rules", {
            type: tCommon(`labels.${OUTPUT_TYPE_LABEL_KEYS[outputType]}`),
          })}
        >
          <EditorBox>
            <EditorPad>
              <form.Field name="lookbackWindow">
                {(field) => (
                  <div className="space-y-2">
                    <Label
                      className="text-muted-foreground text-xs"
                      htmlFor="schedule-lookback"
                    >
                      {tCommon("labels.lookbackWindow")}
                    </Label>
                    <Select
                      onValueChange={(value) => {
                        if (value) {
                          field.handleChange(value as LookbackWindow);
                        }
                      }}
                      value={field.state.value}
                    >
                      <SelectTrigger className="w-full" id="schedule-lookback">
                        <SelectValue
                          placeholder={tCommon("labels.lookbackWindow")}
                        >
                          <span>{lookbackLabel(field.state.value)}</span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {LOOKBACK_WINDOWS.map((window) => (
                          <SelectItem key={window} value={window}>
                            <span>{lookbackLabel(window)}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form.Field>

              {brandVoices.length > 1 && (
                <form.Field name="brandVoiceId">
                  {(field) => (
                    <BrandIdentityRadioGroup
                      description={t("dialog.brandVoiceDescription")}
                      emptyOption={{
                        label: defaultBrandVoiceLabel,
                        description: t("dialog.brandVoiceDefaultDescription"),
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
              )}
            </EditorPad>
            {supportsAutoPublish(outputType) && (
              <form.Field name="autoPublish">
                {(field) => (
                  <TriggerSwitchRow
                    checked={field.state.value}
                    id={field.name}
                    label={t("dialog.autoPublish")}
                    onCheckedChange={field.handleChange}
                    tooltip={t("dialog.autoPublishHint")}
                  />
                )}
              </form.Field>
            )}
          </EditorBox>
        </EditorSection>

        <EditorFooter
          status={
            formError ? (
              <span className="text-destructive flex items-center gap-1.5 font-medium">
                <HugeiconsIcon className="size-3.5" icon={AlertCircleIcon} />
                {formError}
              </span>
            ) : null
          }
        >
          <Button
            className="text-destructive hover:text-destructive"
            disabled={mutation.isPending}
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {tCommon("actions.cancel")}
          </Button>
          <Button loading={mutation.isPending} type="submit">
            {isEditMode ? tCommon("actions.saveChanges") : t("dialog.add")}
          </Button>
        </EditorFooter>
      </form>
      {githubIntegrationId ? (
        <AddRepositoryDialog
          integrationId={githubIntegrationId}
          onOpenChange={(isOpen) => {
            setAddRepoOpen(isOpen);
          }}
          open={addRepoOpen}
          organizationId={organizationId}
        />
      ) : (
        <AddIntegrationDialog
          onOpenChange={(isOpen) => {
            setAddRepoOpen(isOpen);
          }}
          open={addRepoOpen}
          organizationId={organizationId}
        />
      )}
    </>
  );
}
