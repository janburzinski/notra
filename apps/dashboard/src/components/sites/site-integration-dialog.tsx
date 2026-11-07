"use client";

import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { siteIntegrationSchemas } from "@notra/sites-core/schemas/site-integrations";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { CopyButton } from "@notra/ui/components/ui/copy-button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@notra/ui/components/ui/field";
import { Input } from "@notra/ui/components/ui/input";
import { Switch } from "@notra/ui/components/ui/switch";
import { useId, useState } from "react";
import { highlight } from "sugar-high";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { SiteIntegrationLogo } from "@/components/sites/site-integration-logo";
import { SiteIntegrationPullRequestStatus } from "@/components/sites/site-integration-pull-request-status";
import { useSaveSiteIntegration } from "@/lib/hooks/use-site-integrations";
import type { SiteIntegrationDialogProps } from "@/types/components/sites";
import type {
  SiteIntegrationSaveResult,
  SiteIntegrationValues,
} from "@/types/site-integrations";
import { toastCopyError } from "@/utils/copy-to-clipboard";
import {
  siteIntegrationExampleSettings,
  siteIntegrationFieldErrors,
  siteIntegrationFormValues,
  siteIntegrationSettingsFromValues,
  siteIntegrationUpdateFromValues,
} from "@/utils/site-integrations";

export function SiteIntegrationDialog({
  scope,
  provider,
  settings,
  open,
  onOpenChange,
}: SiteIntegrationDialogProps) {
  const t = useTranslations("sites.integrationsPage");
  const tCommon = useTranslations("common");
  const id = useId();
  const save = useSaveSiteIntegration(scope);
  const [values, setValues] = useState<SiteIntegrationValues>(() =>
    siteIntegrationFormValues(provider, settings)
  );
  // The settings the last save proposed; Save stays off until the form differs.
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(
      siteIntegrationSettingsFromValues(
        provider,
        siteIntegrationFormValues(provider, settings),
        settings
      )
    )
  );
  const [result, setResult] = useState<SiteIntegrationSaveResult | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const next = siteIntegrationSettingsFromValues(provider, values, settings);
  const errors = siteIntegrationFieldErrors(provider, next);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = JSON.stringify(next) !== baseline;
  const removing = save.isPending && save.variables?.settings === null;
  const saving = save.isPending && !removing;
  const removalOpened =
    result?.action === "remove" && result.pullRequestUrl !== null;
  const parsed = siteIntegrationSchemas[provider.id].safeParse(next);
  const configExample = JSON.stringify(
    {
      integrations: {
        [provider.id]: siteIntegrationExampleSettings(
          provider,
          parsed.success ? parsed.data : next
        ),
      },
    },
    null,
    2
  );

  const change = (key: string, value: string | boolean) => {
    setValues({ ...values, [key]: value });
    setResult(null);
    save.reset();
  };

  const submit = () => {
    if (hasErrors) {
      setShowErrors(true);
      return;
    }
    const update = siteIntegrationUpdateFromValues(provider, values, settings);
    if (!dirty || !update || save.isPending) {
      return;
    }
    const proposed = JSON.stringify(next);
    save.mutate(update, {
      onSuccess: ({ pullRequestUrl }) => {
        setBaseline(proposed);
        setResult({ action: "save", pullRequestUrl });
      },
    });
  };

  const remove = () => {
    setResult(null);
    save.mutate(
      { provider: provider.id, settings: null },
      {
        onSuccess: ({ pullRequestUrl }) =>
          setResult({ action: "remove", pullRequestUrl }),
      }
    );
  };

  const textFields = provider.fields.filter(
    (field) => field.type !== "boolean"
  );
  const toggleFields = provider.fields.filter(
    (field) => field.type === "boolean"
  );
  const fieldLabel = (key: string) =>
    t(`fields.${provider.id}.${key}` as Parameters<typeof t>[0]);
  const fieldError = (key: string) =>
    t(`fieldErrors.${provider.id}.${key}` as Parameters<typeof t>[0]);
  const fieldDescriptionKey = (key: string) =>
    `fieldDescriptions.${provider.id}.${key}` as Parameters<typeof t>[0];

  return (
    <ResponsiveDialog
      onOpenChange={(nextOpen) => {
        if (!(nextOpen || save.isPending)) {
          onOpenChange(false);
        }
      }}
      open={open}
    >
      <ResponsiveDialogContent className="flex max-h-[85svh] flex-col overflow-hidden sm:max-w-xl">
        <ResponsiveDialogHeader className="shrink-0">
          <div className="flex items-center gap-3">
            <SiteIntegrationLogo provider={provider} />
            <div className="min-w-0 space-y-0.5 text-left">
              <ResponsiveDialogTitle>{provider.name}</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                {t(`providers.${provider.id}`)}
              </ResponsiveDialogDescription>
            </div>
          </div>
        </ResponsiveDialogHeader>
        <form
          className="scrollbar-floating -mx-3 min-h-0 min-w-0 space-y-5 overflow-y-auto px-3"
          id={`${id}-form`}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {textFields.map((field) => {
            const fieldId = `${id}-${field.key}`;
            const error =
              showErrors && errors[field.key]
                ? fieldError(field.key)
                : undefined;
            const value = values[field.key];
            const description = t.has(fieldDescriptionKey(field.key))
              ? t(fieldDescriptionKey(field.key))
              : null;
            const describedBy = [
              description ? `${fieldId}-description` : null,
              error ? `${fieldId}-error` : null,
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <Field data-invalid={error ? true : undefined} key={field.key}>
                <FieldLabel htmlFor={fieldId}>
                  {fieldLabel(field.key)}
                  {field.optional ? (
                    <span className="text-muted-foreground font-normal">
                      {t("optional")}
                    </span>
                  ) : null}
                </FieldLabel>
                <Input
                  aria-describedby={describedBy || undefined}
                  aria-invalid={error ? true : undefined}
                  autoCapitalize="none"
                  autoComplete="off"
                  disabled={save.isPending}
                  id={fieldId}
                  onBlur={() => {
                    if (dirty) {
                      setShowErrors(true);
                    }
                  }}
                  onChange={(event) => change(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  spellCheck={false}
                  value={typeof value === "string" ? value : ""}
                />
                {description ? (
                  <FieldDescription id={`${fieldId}-description`}>
                    {description}
                  </FieldDescription>
                ) : null}
                {error ? (
                  <FieldError id={`${fieldId}-error`}>{error}</FieldError>
                ) : null}
              </Field>
            );
          })}
          {toggleFields.length > 0 ? (
            <div className="divide-y rounded-lg border">
              {toggleFields.map((field) => {
                const fieldId = `${id}-${field.key}`;
                return (
                  <Field
                    className="px-3 py-2.5"
                    key={field.key}
                    orientation="horizontal"
                  >
                    <FieldContent>
                      <FieldLabel htmlFor={fieldId}>
                        {fieldLabel(field.key)}
                      </FieldLabel>
                      <FieldDescription id={`${fieldId}-description`}>
                        {t(fieldDescriptionKey(field.key))}
                      </FieldDescription>
                    </FieldContent>
                    <Switch
                      aria-describedby={`${fieldId}-description`}
                      checked={values[field.key] === true}
                      className="cursor-pointer"
                      disabled={save.isPending}
                      id={fieldId}
                      onCheckedChange={(checked) => change(field.key, checked)}
                    />
                  </Field>
                );
              })}
            </div>
          ) : null}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{t("configExample")}</p>
              <CopyButton
                copiedLabel={tCommon("actions.copied")}
                onCopyError={toastCopyError}
                size="sm"
                value={configExample}
                variant="outline"
              >
                {tCommon("actions.copy")}
              </CopyButton>
            </div>
            <pre
              className="bg-muted/40 border-border/60 scrollbar-floating m-0 overflow-x-auto rounded-lg border p-3 font-mono text-xs leading-relaxed"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: sugar-high escapes the source before tokenizing
              dangerouslySetInnerHTML={{ __html: highlight(configExample) }}
            />
          </div>
          <FieldDescription>
            <a
              className="inline-flex items-center gap-1"
              href={provider.docsUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("docs", { provider: provider.name })}
              <HugeiconsIcon
                aria-hidden="true"
                icon={ArrowUpRight01Icon}
                size={12}
              />
            </a>
          </FieldDescription>
        </form>
        <SiteIntegrationPullRequestStatus error={save.error} result={result} />
        <ResponsiveDialogFooter className="shrink-0 sm:flex-wrap sm:justify-between">
          {settings === null ? (
            <span aria-hidden="true" />
          ) : (
            <Button
              disabled={save.isPending || removalOpened}
              loading={removing}
              onClick={remove}
              type="button"
              variant="destructive"
            >
              {t("remove")}
            </Button>
          )}
          <div className="flex min-w-0 flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
            <Button
              disabled={save.isPending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {t("close")}
            </Button>
            <Button
              disabled={!dirty || hasErrors || save.isPending}
              form={`${id}-form`}
              loading={saving}
              type="submit"
              data-dialog-confirm
            >
              {t("save")}
            </Button>
          </div>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
