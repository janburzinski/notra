"use client";

import {
  repositoryContentPathTemplateSchema,
  repositoryImagePathTemplateSchema,
} from "@notra/schemas/dashboard/integrations";
import { Field, FieldLabel } from "@notra/ui/components/ui/field";
import { Input } from "@notra/ui/components/ui/input";
import { useForm } from "@tanstack/react-form";
import { useId } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import type { GitHubPublishingPathFieldsProps } from "@/types/integrations/github";

export function GitHubPublishingPathFields({
  contentPath,
  directory,
  disabled = false,
  imagePath,
  isSaving = false,
  onCancel,
  onDirtyChange,
  onSave,
}: GitHubPublishingPathFieldsProps) {
  const t = useTranslations("integrations.github.pathFields");
  const tCommon = useTranslations("common");
  const contentPathId = useId();
  const imagePathId = useId();

  const form = useForm({
    defaultValues: {
      contentPath: contentPath ?? "",
      imagePath: imagePath ?? "",
    },
    listeners: {
      onChange: ({ formApi }) => {
        onDirtyChange(
          formApi.state.values.contentPath !== (contentPath ?? "") ||
            formApi.state.values.imagePath !== (imagePath ?? "")
        );
      },
    },
    onSubmit: ({ value }) => {
      const rawContentPath = value.contentPath.trim();
      const rawImagePath = value.imagePath.trim();
      const parsedContentPath = rawContentPath
        ? repositoryContentPathTemplateSchema.safeParse(rawContentPath)
        : null;
      const parsedImagePath = rawImagePath
        ? repositoryImagePathTemplateSchema.safeParse(rawImagePath)
        : null;
      const error =
        (parsedContentPath && !parsedContentPath.success
          ? t("contentPathInvalid")
          : null) ??
        (parsedImagePath && !parsedImagePath.success
          ? t("imagePathInvalid")
          : null);
      if (error) {
        toast.error(error);
        return;
      }

      onSave({
        contentPath: parsedContentPath?.data ?? null,
        imagePath: parsedImagePath?.data ?? null,
      });
    },
  });

  return (
    <form
      className="space-y-4"
      onReset={() => {
        form.reset();
        onDirtyChange(false);
        onCancel();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="contentPath">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={contentPathId}>{t("contentPath")}</FieldLabel>
            <Input
              disabled={disabled || isSaving}
              id={contentPathId}
              name="contentPath"
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder={`${directory ? `${directory}/` : ""}:slug.md`}
              value={field.state.value}
            />
          </Field>
        )}
      </form.Field>

      <form.Field name="imagePath">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={imagePathId}>{t("imagePath")}</FieldLabel>
            <Input
              disabled={disabled || isSaving}
              id={imagePathId}
              name="imagePath"
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="public/blog/:slug/image"
              value={field.state.value}
            />
          </Field>
        )}
      </form.Field>

      <div className="flex justify-end gap-2">
        <Button disabled={isSaving} size="sm" type="reset" variant="ghost">
          {tCommon("actions.cancel")}
        </Button>
        <Button disabled={disabled} loading={isSaving} size="sm" type="submit">
          {tCommon("actions.save")}
        </Button>
      </div>
    </form>
  );
}
