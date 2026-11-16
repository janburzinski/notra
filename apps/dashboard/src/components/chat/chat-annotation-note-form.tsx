"use client";

import { Textarea } from "@notra/ui/components/ui/textarea";
import { cn } from "@notra/ui/lib/utils";
import { useForm } from "@tanstack/react-form";
import { useEffect, useRef } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import type { ChatAnnotationNoteFormProps } from "@/types/components/chat-annotation-note-form";

export function ChatAnnotationNoteForm({
  className,
  initialNote = "",
  onCancel,
  onSubmit,
  submitLabel,
}: ChatAnnotationNoteFormProps) {
  const t = useTranslations("chat.annotations");
  const form = useForm({
    defaultValues: { note: initialNote },
    onSubmit: ({ value }) => onSubmit(value.note.trim()),
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, []);

  return (
    <form
      className={cn("flex w-72 flex-col gap-1.5 p-1", className)}
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="note">
        {(field) => (
          <Textarea
            aria-label={t("noteLabel")}
            ref={textareaRef}
            className="max-h-32 min-h-14 resize-none"
            maxLength={500}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                onCancel();
              }
            }}
            placeholder={t("notePlaceholder")}
            rows={2}
            value={field.state.value}
          />
        )}
      </form.Field>
      <div className="flex justify-end gap-1">
        <Button onClick={onCancel} size="xs" type="button" variant="ghost">
          {t("cancel")}
        </Button>
        <Button size="xs" type="submit">
          {submitLabel ?? t("add")}
        </Button>
      </div>
    </form>
  );
}
