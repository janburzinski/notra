"use client";

import { Delete02Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CONTENT_AUTHOR_BIO_MAX_LENGTH,
  CONTENT_AUTHOR_SLUG_MAX_LENGTH,
  CONTENT_AUTHOR_NAME_MAX_LENGTH,
  CONTENT_AUTHOR_TITLE_MAX_LENGTH,
} from "@notra/schemas/constants/dashboard/post-metadata";
import {
  type ContentAuthor,
  contentAuthorFieldsSchema,
} from "@notra/schemas/shared/post-metadata";
import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
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
import { Textarea } from "@notra/ui/components/ui/textarea";
import { useForm } from "@tanstack/react-form";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { ContentAuthorAvatar } from "@/components/content/overview/overview-author-select";
import { CONTENT_AUTHOR_LINK_FIELDS } from "@/constants/content-overview";
import { useContentAuthors } from "@/lib/hooks/use-content-authors";
import { uploadContentMedia } from "@/lib/upload/client";
import type {
  ContentAuthorDraft,
  ContentAuthorFormProps,
  ContentAuthorsDialogProps,
} from "@/types/content/overview";
import { authorSlugBase } from "@/utils/content-authors";
import { toErrorMessage } from "@/utils/error-message";

function toDraft(author: ContentAuthor | null): ContentAuthorDraft {
  return {
    name: author?.name ?? "",
    slug: author?.slug ?? "",
    title: author?.title ?? "",
    bio: author?.bio ?? "",
    avatarUrl: author?.avatarUrl ?? null,
    url: author?.url ?? "",
    x: author?.x ?? "",
    linkedin: author?.linkedin ?? "",
    github: author?.github ?? "",
    youtube: author?.youtube ?? "",
    bluesky: author?.bluesky ?? "",
    mastodon: author?.mastodon ?? "",
    threads: author?.threads ?? "",
    instagram: author?.instagram ?? "",
  };
}

function AuthorForm({
  organizationId,
  author,
  onDone,
}: ContentAuthorFormProps) {
  const t = useTranslations("content.overview.authorDialog");
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const { create, update } = useContentAuthors(organizationId);
  const slugEdited = useRef(Boolean(author));
  const [uploading, setUploading] = useState(false);
  const form = useForm({
    defaultValues: toDraft(author),
    onSubmit: async ({ value }) => {
      const parsed = contentAuthorFieldsSchema.safeParse(value);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? t("saveFailed"));
        return;
      }
      try {
        if (author) {
          await update.mutateAsync({
            organizationId,
            authorId: author.id,
            author: parsed.data,
          });
        } else {
          await create.mutateAsync({ organizationId, author: parsed.data });
        }
        toast.success(t("saved"));
        onDone();
      } catch (error) {
        toast.error(toErrorMessage(error, t("saveFailed")));
      }
    },
  });

  const uploadAvatar = async (file: File | undefined) => {
    if (!file?.type.startsWith("image/")) {
      return;
    }
    setUploading(true);
    try {
      const { url } = await uploadContentMedia(file, "image", t("saveFailed"));
      form.setFieldValue("avatarUrl", url);
    } catch (error) {
      toast.error(toErrorMessage(error, t("saveFailed")));
    }
    setUploading(false);
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="flex items-center gap-3">
        <form.Subscribe
          selector={(state) => ({
            name: state.values.name,
            avatarUrl: state.values.avatarUrl,
          })}
        >
          {({ name, avatarUrl }) => (
            <ContentAuthorAvatar
              author={{ name: name || "?", avatarUrl }}
              className="size-12"
            />
          )}
        </form.Subscribe>
        <input
          accept="image/*"
          aria-label={t("uploadAvatar")}
          className="sr-only"
          onChange={(event) => {
            void uploadAvatar(event.target.files?.[0]);
            event.target.value = "";
          }}
          ref={fileRef}
          tabIndex={-1}
          type="file"
        />
        <Button
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          size="sm"
          type="button"
          variant="secondary"
        >
          {t("uploadAvatar")}
        </Button>
        <form.Field name="avatarUrl">
          {(field) =>
            field.state.value ? (
              <Button
                onClick={() => field.handleChange(null)}
                size="sm"
                type="button"
                variant="ghost"
              >
                {t("removeAvatar")}
              </Button>
            ) : null
          }
        </form.Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <form.Field
          listeners={{
            onChange: ({ value }) => {
              if (!slugEdited.current) {
                form.setFieldValue("slug", authorSlugBase(value));
              }
            },
          }}
          name="name"
        >
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-name`}>{t("name")}</Label>
              <Input
                autoFocus
                id={`${id}-name`}
                maxLength={CONTENT_AUTHOR_NAME_MAX_LENGTH}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                required
                value={field.state.value}
              />
            </div>
          )}
        </form.Field>
        <form.Field name="title">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-title`}>{t("role")}</Label>
              <Input
                id={`${id}-title`}
                maxLength={CONTENT_AUTHOR_TITLE_MAX_LENGTH}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
            </div>
          )}
        </form.Field>
      </div>
      <form.Field name="slug">
        {(field) => (
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-slug`}>{t("slug")}</Label>
            <Input
              className="font-mono text-xs"
              id={`${id}-slug`}
              maxLength={CONTENT_AUTHOR_SLUG_MAX_LENGTH}
              onBlur={field.handleBlur}
              onChange={(event) => {
                slugEdited.current = true;
                field.handleChange(event.target.value.toLowerCase());
              }}
              required
              value={field.state.value}
            />
            <p className="text-muted-foreground text-xs">
              {t("slugHint", { slug: field.state.value || "…" })}
            </p>
          </div>
        )}
      </form.Field>
      <form.Field name="bio">
        {(field) => (
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-bio`}>{t("bio")}</Label>
            <Textarea
              className="min-h-16 resize-none"
              id={`${id}-bio`}
              maxLength={CONTENT_AUTHOR_BIO_MAX_LENGTH}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>
      <div className="grid grid-cols-2 gap-3">
        {CONTENT_AUTHOR_LINK_FIELDS.map((linkField) => (
          <form.Field key={linkField} name={linkField}>
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-${linkField}`}>
                  {t(linkField === "url" ? "website" : linkField)}
                </Label>
                <Input
                  id={`${id}-${linkField}`}
                  inputMode="url"
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="https://"
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>
        ))}
      </div>
      <ResponsiveDialogFooter>
        <Button onClick={onDone} type="button" variant="ghost">
          {t("back")}
        </Button>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button
              data-dialog-confirm
              disabled={isSubmitting || uploading}
              type="submit"
            >
              {t("save")}
            </Button>
          )}
        </form.Subscribe>
      </ResponsiveDialogFooter>
    </form>
  );
}

export function ContentAuthorsDialog({
  organizationId,
  open,
  onOpenChange,
}: ContentAuthorsDialogProps) {
  const t = useTranslations("content.overview.authorDialog");
  const { authors, currentUserId, remove } = useContentAuthors(organizationId);
  const [editing, setEditing] = useState<ContentAuthor | "new" | null>(null);

  const deleteAuthor = async (author: ContentAuthor) => {
    try {
      await remove.mutateAsync({ organizationId, authorId: author.id });
      toast.success(t("deleted"));
    } catch (error) {
      toast.error(toErrorMessage(error, t("saveFailed")));
    }
  };

  return (
    <ResponsiveDialog
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setEditing(null);
        }
      }}
      open={open}
    >
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {editing === "new" ? t("new") : editing ? editing.name : t("title")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t("description")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {editing ? (
          <AuthorForm
            author={editing === "new" ? null : editing}
            key={editing === "new" ? "new" : editing.id}
            onDone={() => setEditing(null)}
            organizationId={organizationId}
          />
        ) : (
          <div className="space-y-3">
            {authors.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                {t("empty")}
              </p>
            ) : (
              <ul className="divide-border/60 -mx-1 divide-y">
                {authors.map((author) => (
                  <li
                    className="flex items-center gap-3 px-1 py-2"
                    key={author.id}
                  >
                    <ContentAuthorAvatar author={author} className="size-8" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {author.name}
                        {author.userId === currentUserId ? (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            · {t("you")}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {author.title || `/author/${author.slug}`}
                      </p>
                    </div>
                    <Button
                      aria-label={t("edit")}
                      onClick={() => setEditing(author)}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <HugeiconsIcon
                        icon={PencilEdit02Icon}
                        strokeWidth={1.8}
                      />
                    </Button>
                    <ConfirmDialog
                      confirmLabel={t("delete")}
                      onConfirm={() => deleteAuthor(author)}
                      title={t("deleteConfirm", { name: author.name })}
                      trigger={
                        <Button
                          aria-label={t("delete")}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <HugeiconsIcon
                            icon={Delete02Icon}
                            strokeWidth={1.8}
                          />
                        </Button>
                      }
                      variant="destructive"
                    />
                  </li>
                ))}
              </ul>
            )}
            <ResponsiveDialogFooter>
              <Button onClick={() => setEditing("new")}>{t("new")}</Button>
            </ResponsiveDialogFooter>
          </div>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
