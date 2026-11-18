import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import * as z from "zod";

import { Button } from "@/components/button";
import type { AddIdentityDialogProps } from "@/types/brand-identity";
import { sanitizeBrandUrlInput } from "@/utils/brand-identity";

import {
  useAnalyzeBrand,
  useCreateBrandVoice,
} from "../../../../../../lib/hooks/use-brand-analysis";

export function AddIdentityDialog({
  open,
  onOpenChange,
  organizationId,
  onCreated,
  startPolling,
}: AddIdentityDialogProps) {
  const t = useTranslations("brand.identity.addIdentity");
  const tBrandShared = useTranslations("brand.shared");
  const tCommon2 = useTranslations("common");
  const tCommon = useTranslations("common.actions");
  const createMutation = useCreateBrandVoice(organizationId);
  const analyzeMutation = useAnalyzeBrand(organizationId, startPolling);

  const isSubmitting = createMutation.isPending || analyzeMutation.isPending;

  const form = useForm({
    defaultValues: { name: "", url: "" },
    onSubmit: async ({ value, formApi }) => {
      const trimmedName = value.name.trim();
      const trimmedUrl = value.url.trim();

      if (!trimmedName) {
        toast.error(tBrandShared("enterAnIdentityName"));
        return;
      }

      if (!trimmedUrl) {
        toast.error(tCommon2("messages.enterAWebsiteUrl"));
        return;
      }

      let websiteUrl = trimmedUrl;
      if (!trimmedUrl.startsWith("https://")) {
        websiteUrl = `https://${trimmedUrl}`;
      }

      const parseRes = z.url().safeParse(websiteUrl);
      if (!parseRes.success) {
        toast.error(tCommon2("messages.enterAValidWebsite"));
        return;
      }

      try {
        const result = await createMutation.mutateAsync({
          name: trimmedName,
          websiteUrl,
        });
        const voice = result.voice;
        onCreated(voice);
        onOpenChange(false);
        setTimeout(() => formApi.reset(), 300);

        try {
          await analyzeMutation.mutateAsync({
            url: websiteUrl,
            voiceId: voice.id,
          });
          toast.success(
            tCommon2("messages.brandIdentityCreatedAnalysisStarted")
          );
        } catch {
          toast.error(tCommon2("messages.brandIdentityCreatedButFailed"));
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : tCommon2("messages.failedToCreateBrandIdentity")
        );
      }
    },
  });

  return (
    <ResponsiveDialog onOpenChange={onOpenChange} open={open}>
      <ResponsiveDialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-md [&>*]:min-w-0">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{t("title")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t("description")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form
          className="min-w-0 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="voice-name">{tCommon2("labels.name")}</Label>
                <Input
                  autoFocus
                  id="voice-name"
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t("namePlaceholder")}
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="url">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="voice-url">{tCommon2("labels.website")}</Label>
                <div className="border-border focus-within:border-ring focus-within:ring-ring/50 flex w-full min-w-0 flex-row items-center rounded-lg border transition-colors">
                  <label
                    className="border-border text-muted-foreground border-r px-2.5 py-1.5 text-sm transition-colors"
                    htmlFor="voice-url"
                  >
                    https://
                  </label>
                  <input
                    className="min-w-0 flex-1 bg-transparent px-2.5 py-1.5 text-sm outline-none"
                    id="voice-url"
                    onBlur={field.handleBlur}
                    onChange={(e) =>
                      field.handleChange(sanitizeBrandUrlInput(e.target.value))
                    }
                    placeholder="example.com"
                    type="text"
                    value={field.state.value}
                  />
                </div>
                <p className="text-muted-foreground text-xs">
                  {t("websiteHint")}
                </p>
              </div>
            )}
          </form.Field>
          <ResponsiveDialogFooter>
            <ResponsiveDialogClose
              disabled={isSubmitting}
              render={
                <Button
                  className="w-full justify-center sm:w-auto"
                  variant="outline"
                />
              }
            >
              {tCommon("cancel")}
            </ResponsiveDialogClose>
            <form.Subscribe
              selector={(state) =>
                Boolean(state.values.name.trim() && state.values.url.trim())
              }
            >
              {(hasValues) => (
                <Button
                  className="w-full justify-center sm:w-auto"
                  disabled={!hasValues || isSubmitting}
                  type="submit"
                  data-dialog-confirm
                >
                  {isSubmitting
                    ? tCommon("creating")
                    : tBrandShared("createIdentity")}
                </Button>
              )}
            </form.Subscribe>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
