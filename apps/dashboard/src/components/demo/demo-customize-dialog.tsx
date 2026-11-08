"use client";

import type { DemoPersonalization } from "@notra/db/types/demo";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { Button } from "@notra/ui/components/ui/button";
import { Field, FieldLabel } from "@notra/ui/components/ui/field";
import { Input } from "@notra/ui/components/ui/input";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import {
  DEMO_PERSONALIZATION_COMPANY_MAX,
  DEMO_PERSONALIZATION_NAME_MAX,
} from "@/constants/demo";
import { demoPersonalizationSchema } from "@/schemas/demo";
import { demoHomePath } from "@/utils/demo-return-to";
import { rebuildDemoSandbox } from "@/utils/demo-sandbox-request";

interface DemoCustomizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: DemoPersonalization | null;
}

export function DemoCustomizeDialog({
  open,
  onOpenChange,
  current,
}: DemoCustomizeDialogProps) {
  const t = useTranslations("demo.customize");
  const form = useForm({
    defaultValues: {
      firstName: current?.firstName ?? "",
      lastName: current?.lastName ?? "",
      companyName: current?.companyName ?? "",
    },
    onSubmit: async ({ value }) => {
      const parsed = demoPersonalizationSchema.safeParse(value);
      if (!parsed.success) {
        return;
      }
      try {
        const slug = await rebuildDemoSandbox("customize", parsed.data);
        window.location.assign(demoHomePath(slug));
        await new Promise<never>(() => undefined);
      } catch {
        toast.error(t("failed"));
      }
    },
  });

  return (
    <ResponsiveDialog onOpenChange={onOpenChange} open={open}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.Subscribe
            selector={(state) => ({
              saving: state.isSubmitting,
              isValid: demoPersonalizationSchema.safeParse(state.values)
                .success,
            })}
          >
            {({ saving, isValid }) => (
              <>
                <ResponsiveDialogHeader>
                  <ResponsiveDialogTitle>{t("title")}</ResponsiveDialogTitle>
                  <ResponsiveDialogDescription>
                    {t("description")}
                  </ResponsiveDialogDescription>
                </ResponsiveDialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <form.Field name="firstName">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor="demo-first-name">
                          {t("firstName")}
                        </FieldLabel>
                        <Input
                          autoComplete="given-name"
                          disabled={saving}
                          id="demo-first-name"
                          maxLength={DEMO_PERSONALIZATION_NAME_MAX}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          required
                          value={field.state.value}
                        />
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="lastName">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor="demo-last-name">
                          {t("lastName")}
                        </FieldLabel>
                        <Input
                          autoComplete="family-name"
                          disabled={saving}
                          id="demo-last-name"
                          maxLength={DEMO_PERSONALIZATION_NAME_MAX}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          value={field.state.value}
                        />
                      </Field>
                    )}
                  </form.Field>
                </div>
                <form.Field name="companyName">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor="demo-company">
                        {t("companyName")}
                      </FieldLabel>
                      <Input
                        autoComplete="organization"
                        disabled={saving}
                        id="demo-company"
                        maxLength={DEMO_PERSONALIZATION_COMPANY_MAX}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder="Fieldnote"
                        required
                        value={field.state.value}
                      />
                    </Field>
                  )}
                </form.Field>
                <p className="text-muted-foreground text-sm">{t("note")}</p>
                <ResponsiveDialogFooter>
                  <Button
                    disabled={saving}
                    onClick={() => onOpenChange(false)}
                    type="button"
                    variant="outline"
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    data-dialog-confirm
                    disabled={!isValid || saving}
                    type="submit"
                  >
                    {saving ? t("saving") : t("submit")}
                  </Button>
                </ResponsiveDialogFooter>
              </>
            )}
          </form.Subscribe>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
