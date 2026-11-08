"use client";

import { SentIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Textarea } from "@notra/ui/components/ui/textarea";
import { cn } from "@notra/ui/lib/utils";
import { useForm, useStore } from "@tanstack/react-form";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { FEEDBACK_MAX_MESSAGE_LENGTH } from "@/constants/feedback";
import { usePathname } from "@/lib/navigation";
import { dashboardOrpcClient } from "@/lib/orpc/client";
import type {
  FeedbackFormProps,
  FeedbackFormValues,
} from "@/types/dashboard/feedback";
import { FEEDBACK_SENTIMENT_OPTIONS } from "@/utils/feedback";
import { getFeedbackPageUrl } from "@/utils/feedback-page-url";

export function FeedbackForm({
  onSubmitted,
  autoFocus = true,
}: FeedbackFormProps) {
  const t = useTranslations("dashboard.feedback");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const { activeOrganization } = useOrganizationsContext();

  const defaultValues: FeedbackFormValues = { message: "", sentiment: null };
  const form = useForm({
    defaultValues,
    onSubmit: async ({ value, formApi }) => {
      const message = value.message.trim();
      if (!message) {
        return;
      }
      try {
        await dashboardOrpcClient.feedback.submit({
          message,
          sentiment: value.sentiment ?? undefined,
          organizationId: activeOrganization?.id,
          pageUrl: getFeedbackPageUrl(pathname),
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("sendFailed"));
        return;
      }
      toast.success(t("thanks"));
      formApi.reset();
      onSubmitted?.();
    },
  });
  const { isSubmitting, sentiment, trimmed } = useStore(
    form.store,
    (state) => ({
      isSubmitting: state.isSubmitting,
      sentiment: state.values.sentiment,
      trimmed: state.values.message.trim(),
    })
  );
  const canSubmit = trimmed.length > 0 && !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }
    await form.handleSubmit();
  }

  async function handleKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      await handleSubmit();
    }
  }

  return (
    <>
      <div className="p-2.5 pb-0">
        <form.Field name="message">
          {(field) => (
            <Textarea
              aria-label={t("label")}
              autoFocus={autoFocus}
              className="min-h-28 resize-none"
              disabled={isSubmitting}
              maxLength={FEEDBACK_MAX_MESSAGE_LENGTH}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("placeholder")}
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>

      <div className="flex items-center justify-between gap-2 p-2.5">
        <div className="flex items-center gap-0.5">
          {FEEDBACK_SENTIMENT_OPTIONS.map((option) => {
            const isActive = sentiment === option.value;
            return (
              <button
                aria-label={t(`sentiments.${option.value}`)}
                aria-pressed={isActive}
                className={cn(
                  "hover:bg-muted focus-visible:ring-ring/50 flex size-7 cursor-pointer items-center justify-center rounded-md text-base leading-none transition-colors outline-none focus-visible:ring-[3px]",
                  isActive
                    ? "bg-muted opacity-100"
                    : "opacity-60 hover:opacity-100"
                )}
                disabled={isSubmitting}
                key={option.value}
                onClick={() =>
                  form.setFieldValue("sentiment", (current) =>
                    current === option.value ? null : option.value
                  )
                }
                type="button"
              >
                <span aria-hidden="true">{option.emoji}</span>
              </button>
            );
          })}
        </div>

        <Button
          disabled={!canSubmit}
          onClick={handleSubmit}
          size="sm"
          type="button"
        >
          {isSubmitting ? (
            tCommon("labels.sending")
          ) : (
            <>
              {tCommon("labels.send")}
              <HugeiconsIcon
                className="-translate-y-px"
                icon={SentIcon}
                size={14}
              />
            </>
          )}
        </Button>
      </div>
    </>
  );
}
