"use client";

import {
  GEO_PERSONA_BRIEF_MAX_LENGTH,
  GEO_PERSONA_MAX_COUNT,
} from "@notra/geo-core/constants/geo-personas";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@notra/ui/components/shared/responsive-dialog";
import { Label } from "@notra/ui/components/ui/label";
import { Textarea } from "@notra/ui/components/ui/textarea";
import { useForm } from "@tanstack/react-form";
import { useId } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import type { PersonaAddDialogProps } from "@/types/geo-personas-ui";

export function PersonaAddDialog({
  open,
  atLimit,
  onOpenChange,
  onSubmit,
  isPending,
}: PersonaAddDialogProps) {
  const t = useTranslations("geo.personaAddDialog");
  const tCommon2 = useTranslations("common");
  const tCommon = useTranslations("common.actions");
  const id = useId();
  const form = useForm({
    defaultValues: { brief: "" },
    onSubmit: async ({ value, formApi }) => {
      const brief = value.brief.trim();
      if (!brief || isPending || atLimit) {
        return;
      }
      if (await onSubmit(brief)) {
        formApi.reset();
      }
    },
  });
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{t("title")}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t("description")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="flex flex-col gap-3">
            <Label htmlFor={id}>{t("label")}</Label>
            <form.Field name="brief">
              {(field) => (
                <Textarea
                  id={id}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  required
                  maxLength={GEO_PERSONA_BRIEF_MAX_LENGTH}
                  disabled={isPending}
                  placeholder={t("placeholder")}
                  className="max-h-80 min-h-28 resize-none overflow-y-auto"
                />
              )}
            </form.Field>
            {atLimit ? (
              <p className="text-destructive text-sm" role="alert">
                {t("limitReached", { max: GEO_PERSONA_MAX_COUNT })}
              </p>
            ) : null}
          </div>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              data-dialog-confirm
              type="submit"
              disabled={isPending || atLimit}
            >
              {isPending ? tCommon2("labels.starting") : t("generate")}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
