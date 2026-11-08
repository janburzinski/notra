"use client";

import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Field, FieldLabel } from "@notra/ui/components/ui/field";
import { Input } from "@notra/ui/components/ui/input";
import { useForm } from "@tanstack/react-form";
import { useId } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import type { GitHubCreateBranchFormProps } from "@/types/integrations/github";

export function GitHubCreateBranchForm({
  baseBranch,
  errorMessage,
  isPending,
  onCancel,
  onChange,
  onSubmit,
}: GitHubCreateBranchFormProps) {
  const t = useTranslations("integrations.github.createBranch");
  const tIntegrationsShared = useTranslations("integrations.shared");
  const tCommon = useTranslations("common");
  const form = useForm({
    defaultValues: { branchName: "" },
    onSubmit: ({ value }) => {
      const normalizedBranchName = value.branchName.trim();
      if (normalizedBranchName) {
        onSubmit(normalizedBranchName);
      }
    },
  });
  const branchNameId = useId();
  const descriptionId = `${branchNameId}-description`;

  return (
    <form
      aria-label={t("formAriaLabel", { branch: baseBranch })}
      className="flex h-full flex-col gap-4 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="flex items-center gap-2">
        <Button
          aria-label={t("back")}
          disabled={isPending}
          onClick={onCancel}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon className="size-4" icon={ArrowLeft01Icon} />
        </Button>
        <p className="text-sm font-medium">
          {tIntegrationsShared("createBranch")}
        </p>
      </div>
      <form.Field name="branchName">
        {(field) => (
          <Field data-invalid={errorMessage ? true : undefined}>
            <FieldLabel htmlFor={branchNameId}>{t("branchName")}</FieldLabel>
            <Input
              aria-describedby={
                errorMessage
                  ? `${descriptionId} ${branchNameId}-error`
                  : descriptionId
              }
              aria-invalid={Boolean(errorMessage)}
              autoFocus
              disabled={isPending}
              id={branchNameId}
              onBlur={field.handleBlur}
              onChange={(event) => {
                field.handleChange(event.target.value);
                if (errorMessage) {
                  onChange();
                }
              }}
              placeholder="feature/new-content"
              value={field.state.value}
            />
            <p className="sr-only" id={descriptionId}>
              {t("description", { branch: baseBranch })}
            </p>
            {errorMessage ? (
              <p
                className="text-destructive text-xs"
                id={`${branchNameId}-error`}
                role="alert"
              >
                {errorMessage}
              </p>
            ) : null}
          </Field>
        )}
      </form.Field>
      <div className="mt-auto flex justify-between gap-2">
        <Button
          disabled={isPending}
          onClick={onCancel}
          size="sm"
          type="button"
          variant="ghost"
        >
          {tCommon("actions.cancel")}
        </Button>
        <form.Subscribe selector={(state) => state.values.branchName.trim()}>
          {(branchName) => (
            <Button disabled={isPending || !branchName} size="sm" type="submit">
              {isPending
                ? tCommon("actions.creating")
                : tIntegrationsShared("createBranch")}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
