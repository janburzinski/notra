"use client";

import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { Switch } from "@notra/ui/components/ui/switch";
import { useForm } from "@tanstack/react-form";
import { useEffect, useId, useRef } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import {
  ALL_USAGE_FEATURES_VALUE,
  DEFAULT_USAGE_ALERT,
  USAGE_ALERT_THRESHOLD_OPTIONS,
} from "@/constants/usage-alerts";
import { useUsageFeatureName } from "@/lib/hooks/use-usage-feature-name";
import type {
  UsageAlert,
  UsageAlertFormProps,
  UsageAlertFormValues,
  UsageAlertThresholdType,
} from "@/types/billing/usage-alerts";
import { isUsageAlertThresholdType } from "@/utils/usage-alerts";

export function UsageAlertForm({
  features,
  initialAlert,
  onCancel,
  onSubmit,
  pending,
}: UsageAlertFormProps) {
  const t = useTranslations("billing.usageAlerts");
  const tCommon2 = useTranslations("common");
  const tCommon = useTranslations("common.actions");
  const featureName = useUsageFeatureName();
  const enabledId = useId();
  const featureLabelId = useId();
  const nameId = useId();
  const thresholdId = useId();
  const thresholdTypeLabelId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const defaultValues: UsageAlertFormValues = {
    featureId: initialAlert?.featureId ?? ALL_USAGE_FEATURES_VALUE,
    enabled: initialAlert?.enabled ?? DEFAULT_USAGE_ALERT.enabled,
    name: initialAlert?.name ?? "",
    threshold: String(initialAlert?.threshold ?? DEFAULT_USAGE_ALERT.threshold),
    thresholdType:
      initialAlert?.thresholdType ?? DEFAULT_USAGE_ALERT.thresholdType,
  };
  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      const alert: UsageAlert = {
        enabled: value.enabled,
        threshold: Number(value.threshold),
        thresholdType: value.thresholdType,
        ...(value.featureId === ALL_USAGE_FEATURES_VALUE
          ? {}
          : { featureId: value.featureId }),
        ...(value.name.trim() ? { name: value.name.trim() } : {}),
      };
      const saved = await onSubmit(alert);
      if (saved) {
        onCancel();
      }
    },
  });

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const featureNameFor = (value: string) => {
    const feature = features.find((item) => item.id === value);
    return feature ? featureName(feature) : value;
  };

  const editing = initialAlert !== undefined;
  let submitLabel = editing ? tCommon("saveChanges") : t("addAlert");
  if (pending) {
    submitLabel = editing ? tCommon("saving") : tCommon2("labels.adding");
  }

  return (
    <section className="w-full space-y-6">
      <div className="space-y-4">
        <Button
          className="-ms-2.5"
          onClick={onCancel}
          size="sm"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={ArrowLeft02Icon}
            strokeWidth={2}
          />
          {tCommon2("labels.usageAlerts")}
        </Button>
        <div className="space-y-1">
          <h2
            className="text-lg font-semibold outline-none"
            ref={headingRef}
            tabIndex={-1}
          >
            {editing ? t("editTitle") : t("addTitle")}
          </h2>
          <p className="text-muted-foreground text-sm text-pretty">
            {t("formDescription")}
          </p>
        </div>
      </div>

      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          form.handleSubmit();
        }}
      >
        <form.Field name="featureId">
          {(field) => (
            <div className="space-y-2">
              <Label id={featureLabelId}>{t("feature")}</Label>
              <Select
                onValueChange={(value) =>
                  field.handleChange(value ?? ALL_USAGE_FEATURES_VALUE)
                }
                value={field.state.value}
              >
                <SelectTrigger
                  aria-labelledby={featureLabelId}
                  className="w-full"
                >
                  <SelectValue>
                    {(value: string) =>
                      value === ALL_USAGE_FEATURES_VALUE
                        ? t("allFeatures")
                        : featureNameFor(value)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value={ALL_USAGE_FEATURES_VALUE}>
                    {t("allFeatures")}
                  </SelectItem>
                  {features.map((feature) => (
                    <SelectItem key={feature.id} value={feature.id}>
                      {featureName(feature)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {t("allFeaturesHint")}
              </p>
            </div>
          )}
        </form.Field>

        <form.Field name="enabled">
          {(field) => (
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor={enabledId}>{tCommon2("states.enabled")}</Label>
                <p className="text-muted-foreground text-xs">
                  {t("enabledHint")}
                </p>
              </div>
              <Switch
                checked={field.state.value}
                id={enabledId}
                onCheckedChange={field.handleChange}
              />
            </div>
          )}
        </form.Field>

        <form.Field name="name">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={nameId}>{tCommon2("labels.name")}</Label>
              <Input
                id={nameId}
                maxLength={80}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder={t("namePlaceholder")}
                value={field.state.value}
              />
            </div>
          )}
        </form.Field>

        <form.Field name="thresholdType">
          {(field) => (
            <div className="space-y-2">
              <Label id={thresholdTypeLabelId}>{t("thresholdType")}</Label>
              <Select
                onValueChange={(value) => {
                  if (isUsageAlertThresholdType(value)) {
                    field.handleChange(value);
                    form.validateField("threshold", "change");
                  }
                }}
                value={field.state.value}
              >
                <SelectTrigger
                  aria-labelledby={thresholdTypeLabelId}
                  className="w-full"
                >
                  <SelectValue>
                    {(value: UsageAlertThresholdType) =>
                      t(`thresholdTypes.${value}.label`)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  {USAGE_ALERT_THRESHOLD_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`thresholdTypes.${option}.label`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {t(`thresholdTypes.${field.state.value}.description`)}
              </p>
            </div>
          )}
        </form.Field>

        <form.Field
          name="threshold"
          validators={{
            onSubmit: ({ value, fieldApi }) => {
              if (value.trim().length === 0) {
                return { message: t("errors.required") };
              }
              const numericThreshold = Number(value);
              if (!Number.isFinite(numericThreshold) || numericThreshold < 0) {
                return { message: t("errors.min") };
              }
              const isPercentage = fieldApi.form
                .getFieldValue("thresholdType")
                .endsWith("_percentage");
              if (isPercentage && numericThreshold > 100) {
                return { message: t("errors.percentage") };
              }
              return undefined;
            },
          }}
        >
          {(field) => {
            const error = field.state.meta.errors[0]?.message;
            return (
              <div className="space-y-2">
                <Label htmlFor={thresholdId}>{t("threshold")}</Label>
                <Input
                  aria-describedby={error ? `${thresholdId}-error` : undefined}
                  aria-invalid={error ? true : undefined}
                  id={thresholdId}
                  inputMode="decimal"
                  min={0}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  required
                  step="any"
                  type="number"
                  value={field.state.value}
                />
                {error ? (
                  <p
                    className="text-destructive text-xs"
                    id={`${thresholdId}-error`}
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}
              </div>
            );
          }}
        </form.Field>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button
            disabled={pending}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            {tCommon("cancel")}
          </Button>
          <Button disabled={pending} type="submit">
            {submitLabel}
          </Button>
        </div>
      </form>
    </section>
  );
}
