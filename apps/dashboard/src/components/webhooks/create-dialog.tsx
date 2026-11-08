"use client";
import { Copy01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { WEBHOOK_EVENTS } from "@/constants/outbound-webhooks";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  WebhookCreateDialogViewProps,
  WebhookCreateFormValues,
  WebhookCreateProps,
} from "@/types/webhooks/outbound";
import { copyTextToClipboard } from "@/utils/copy-to-clipboard";

const DEFAULT_WEBHOOK_CREATE_VALUES: WebhookCreateFormValues = {
  url: "",
  events: ["post.generation.completed"],
};

export function WebhookCreateDialog({
  organizationId,
  open,
  onOpenChange,
  onCreated,
}: WebhookCreateProps) {
  const [secret, setSecret] = useState<string | null>(null);
  const create = useMutation(
    dashboardOrpc.outboundWebhooks.create.mutationOptions({
      onSuccess: (result) => {
        setSecret(result.secret);
        onCreated();
      },
      onError: (error) => toast.error(error.message),
    })
  );
  return (
    <WebhookCreateDialogView
      open={open}
      onOpenChange={onOpenChange}
      secret={secret}
      pending={create.isPending}
      onSubmit={(url, events) => create.mutate({ organizationId, url, events })}
    />
  );
}

export function WebhookCreateDialogView({
  open,
  onOpenChange,
  secret,
  pending,
  onSubmit,
}: WebhookCreateDialogViewProps) {
  const t = useTranslations("settings.panes.webhooks.create");
  const tActions = useTranslations("common.actions");
  const form = useForm({
    defaultValues: DEFAULT_WEBHOOK_CREATE_VALUES,
    onSubmit: ({ value }) => onSubmit(value.url, value.events),
  });
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          onOpenChange(next);
        }
      }}
    >
      <ResponsiveDialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {secret ? t("readyTitle") : t("title")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {secret ? t("readyDescription") : t("description")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {secret ? (
          <div className="space-y-3">
            <Label htmlFor="webhook-secret">{t("secret")}</Label>
            <div className="flex gap-2">
              <Input
                id="webhook-secret"
                readOnly
                value={secret}
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                aria-label={t("copySecret")}
                onClick={() => copyTextToClipboard(secret, t("secretCopied"))}
              >
                <HugeiconsIcon icon={Copy01Icon} className="size-4" />
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">{t("secretHint")}</p>
          </div>
        ) : (
          <form
            id="create-webhook"
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              form.handleSubmit();
            }}
          >
            <form.Field name="url">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">{t("url")}</Label>
                  <Input
                    id="webhook-url"
                    type="url"
                    required
                    placeholder="https://your-app.com/webhooks/notra"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    autoComplete="off"
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="events">
              {(field) => (
                <fieldset className="space-y-2">
                  <legend className="mb-2 text-sm font-medium">
                    {t("events")}
                  </legend>
                  {WEBHOOK_EVENTS.map((name) => (
                    <label
                      key={name}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"
                    >
                      <input
                        type="checkbox"
                        className="accent-primary size-4"
                        checked={field.state.value.includes(name)}
                        onChange={(event) =>
                          field.handleChange(
                            event.target.checked
                              ? [...field.state.value, name]
                              : field.state.value.filter(
                                  (value) => value !== name
                                )
                          )
                        }
                      />
                      <span className="font-mono text-xs">{name}</span>
                    </label>
                  ))}
                </fieldset>
              )}
            </form.Field>
          </form>
        )}
        <ResponsiveDialogFooter>
          {secret ? (
            <Button onClick={() => onOpenChange(false)}>
              {tActions("done")}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => onOpenChange(false)}
              >
                {tActions("cancel")}
              </Button>
              <form.Subscribe
                selector={(state) => state.values.events.length === 0}
              >
                {(noEvents) => (
                  <Button
                    type="submit"
                    data-dialog-confirm
                    form="create-webhook"
                    disabled={pending || noEvents}
                  >
                    {pending ? tActions("creating") : t("submit")}
                  </Button>
                )}
              </form.Subscribe>
            </>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
