"use client";

import { Alert02Icon, Globe02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CONTENT_AUTHOR_NAME_MAX_LENGTH,
  CONTENT_AUTHOR_SLUG_MAX_LENGTH,
  CONTENT_AUTHOR_TITLE_MAX_LENGTH,
} from "@notra/schemas/constants/dashboard/post-metadata";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@notra/ui/components/ui/field";
import { Input } from "@notra/ui/components/ui/input";
import { Textarea } from "@notra/ui/components/ui/textarea";
import { useId, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { SiteAuthorAvatar } from "@/components/sites/site-author-avatar";
import { SiteAuthorAvatarField } from "@/components/sites/site-author-avatar-field";
import { useSite } from "@/components/sites/site-context";
import { useSiteWorkspace } from "@/components/sites/site-workspace-context";
import { CONTENT_AUTHOR_LINK_FIELDS } from "@/constants/content-overview";
import { SITE_AUTHOR_BIO_MAX_LENGTH } from "@/constants/site-authors";
import { SITE_SOCIAL_LINKS } from "@/constants/site-design";
import { SITE_DEFAULT_BLOG_PATH } from "@/constants/sites";
import { useSiteAuthorForm } from "@/lib/hooks/use-site-author-form";
import type {
  SiteAuthorDialogProps,
  SiteAuthorFieldProps,
  SiteAuthorIdFieldProps,
  SiteAuthorLinkFieldsProps,
  SiteAuthorLinkIconProps,
} from "@/types/site-authors";
import type { SiteSocialPlatform } from "@/types/site-design";
import { siteAuthorPagesPath } from "@/utils/site-authors";

function AuthorField({
  id,
  label,
  error,
  hint,
  children,
}: SiteAuthorFieldProps) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })}
      {hint ? (
        <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>
      ) : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </Field>
  );
}

function LinkIcon({ field }: SiteAuthorLinkIconProps) {
  const Logo =
    field in SITE_SOCIAL_LINKS
      ? SITE_SOCIAL_LINKS[field as SiteSocialPlatform].logo
      : undefined;
  return Logo ? (
    <Logo aria-hidden="true" className="size-3.5 shrink-0" />
  ) : (
    <HugeiconsIcon
      aria-hidden="true"
      className="size-3.5 shrink-0"
      icon={Globe02Icon}
      strokeWidth={1.75}
    />
  );
}

/** Posts name authors by id, so changing one they use needs an explicit unlock that warns. */
function SiteAuthorIdField({
  id,
  value,
  error,
  lockedId,
  usage,
  onChange,
}: SiteAuthorIdFieldProps) {
  const t = useTranslations("sites.design.authors.dialog");
  const { detail } = useSite();
  const [unlocked, setUnlocked] = useState(false);
  const locked = lockedId !== null && !unlocked;
  const shown = value.trim() || "…";
  return (
    <>
      <AuthorField
        error={error}
        hint={t("idHint", {
          id: shown,
          path: `${siteAuthorPagesPath(detail.site.mounts.blog ?? SITE_DEFAULT_BLOG_PATH)}/${shown}`,
        })}
        id={id}
        label={t("id")}
      >
        {(aria) => (
          <div className="flex items-center gap-2">
            <Input
              {...aria}
              autoCapitalize="none"
              autoComplete="off"
              maxLength={CONTENT_AUTHOR_SLUG_MAX_LENGTH}
              onChange={(event) => onChange(event.target.value)}
              readOnly={locked}
              required
              spellCheck={false}
              value={value}
            />
            {locked ? (
              <Button
                onClick={() => setUnlocked(true)}
                size="sm"
                type="button"
                variant="outline"
              >
                {t("changeId")}
              </Button>
            ) : null}
          </div>
        )}
      </AuthorField>
      {lockedId !== null && unlocked ? (
        <p
          className="text-muted-foreground -mt-1 flex items-start gap-1.5 text-xs"
          role="status"
        >
          <HugeiconsIcon
            aria-hidden="true"
            className="text-warning mt-px size-3.5 shrink-0"
            icon={Alert02Icon}
            strokeWidth={1.75}
          />
          {usage === null
            ? t("idWarningUnknown", { id: lockedId })
            : t("idWarning", { id: lockedId, count: usage })}
        </p>
      ) : null}
    </>
  );
}

function SiteAuthorLinkFields({
  idPrefix,
  form,
  errors,
  onChange,
}: SiteAuthorLinkFieldsProps) {
  const t = useTranslations("sites.design.authors.dialog");
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{t("links")}</legend>
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        {CONTENT_AUTHOR_LINK_FIELDS.map((field) => {
          const fieldId = `${idPrefix}-${field}`;
          const error = errors[field];
          return (
            <Field data-invalid={error ? true : undefined} key={field}>
              <label
                className="text-muted-foreground flex items-center gap-1.5 text-xs"
                htmlFor={fieldId}
              >
                <LinkIcon field={field} />
                {t(`linkLabels.${field}`)}
              </label>
              <Input
                aria-describedby={error ? `${fieldId}-error` : undefined}
                aria-invalid={error ? true : undefined}
                autoCapitalize="none"
                autoComplete="off"
                id={fieldId}
                inputMode="url"
                onChange={(event) => onChange(field, event.target.value)}
                placeholder="https://"
                spellCheck={false}
                type="url"
                value={form[field]}
              />
              {error ? (
                <FieldError id={`${fieldId}-error`}>
                  {t(`errors.${error}`)}
                </FieldError>
              ) : null}
            </Field>
          );
        })}
      </div>
    </fieldset>
  );
}

export function SiteAuthorDialog({
  open,
  onOpenChange,
  entry,
  takenIds,
  usage,
  published,
  onSave,
}: SiteAuthorDialogProps) {
  const t = useTranslations("sites.design.authors.dialog");
  const workspace = useSiteWorkspace();
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const { form, set, setName, setId, errors, submit } = useSiteAuthorForm(
    entry,
    takenIds
  );
  const message = (key: keyof typeof form) => {
    const error = errors[key];
    return error ? t(`errors.${error}`) : undefined;
  };
  const lockedId = entry && (published || (usage ?? 0) > 0) ? entry.id : null;

  return (
    <ResponsiveDialog onOpenChange={onOpenChange} open={open}>
      <ResponsiveDialogContent className="flex max-h-[85svh] flex-col overflow-hidden sm:max-w-xl">
        <ResponsiveDialogHeader className="shrink-0">
          <div className="flex items-center gap-3">
            <SiteAuthorAvatar
              avatar={form.avatar.trim() || undefined}
              className="size-10"
              name={form.name}
            />
            <div className="min-w-0 space-y-0.5 text-left">
              <ResponsiveDialogTitle>
                {entry
                  ? t("editTitle", { name: entry.author.name })
                  : t("newTitle")}
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                {t("description")}
              </ResponsiveDialogDescription>
            </div>
          </div>
        </ResponsiveDialogHeader>
        <form
          className="scrollbar-floating -mx-3 min-h-0 min-w-0 space-y-5 overflow-y-auto px-3 pb-1"
          id={`${id}-form`}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const saved = submit();
            if (saved) {
              onSave(entry?.id ?? null, saved);
              onOpenChange(false);
              return;
            }
            requestAnimationFrame(() =>
              formRef.current
                ?.querySelector<HTMLElement>("[aria-invalid=true]")
                ?.focus()
            );
          }}
          ref={formRef}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <AuthorField
              error={message("name")}
              id={`${id}-name`}
              label={t("name")}
            >
              {(aria) => (
                <Input
                  {...aria}
                  autoComplete="off"
                  maxLength={CONTENT_AUTHOR_NAME_MAX_LENGTH}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("namePlaceholder")}
                  required
                  value={form.name}
                />
              )}
            </AuthorField>
            <AuthorField
              error={message("title")}
              id={`${id}-title`}
              label={t("role")}
            >
              {(aria) => (
                <Input
                  {...aria}
                  autoComplete="off"
                  maxLength={CONTENT_AUTHOR_TITLE_MAX_LENGTH}
                  onChange={(event) => set({ title: event.target.value })}
                  placeholder={t("rolePlaceholder")}
                  value={form.title}
                />
              )}
            </AuthorField>
          </div>
          <SiteAuthorIdField
            error={message("id")}
            id={`${id}-id`}
            lockedId={lockedId}
            onChange={setId}
            usage={usage}
            value={form.id}
          />
          <AuthorField
            error={message("avatar")}
            hint={t("avatarHint")}
            id={`${id}-avatar`}
            label={t("avatar")}
          >
            {(aria) => (
              <SiteAuthorAvatarField
                aria={aria}
                id={`${id}-avatar`}
                name={form.name}
                onChange={(avatar) => set({ avatar })}
                value={form.avatar}
              />
            )}
          </AuthorField>
          <AuthorField
            error={message("bio")}
            hint={t("bioCount", {
              count: form.bio.trim().length,
              max: SITE_AUTHOR_BIO_MAX_LENGTH,
            })}
            id={`${id}-bio`}
            label={t("bio")}
          >
            {(aria) => (
              <Textarea
                {...aria}
                className="min-h-20 resize-none"
                maxLength={SITE_AUTHOR_BIO_MAX_LENGTH}
                onChange={(event) => set({ bio: event.target.value })}
                placeholder={t("bioPlaceholder")}
                value={form.bio}
              />
            )}
          </AuthorField>
          <SiteAuthorLinkFields
            errors={errors}
            form={form}
            idPrefix={id}
            onChange={(field, value) => set({ [field]: value })}
          />
        </form>
        <ResponsiveDialogFooter className="shrink-0">
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="ghost"
          >
            {t("cancel")}
          </Button>
          <Button
            data-dialog-confirm
            disabled={Boolean(workspace?.readOnly)}
            form={`${id}-form`}
            type="submit"
          >
            {entry ? t("save") : t("add")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
