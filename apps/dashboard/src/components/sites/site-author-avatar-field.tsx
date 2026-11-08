"use client";

import { Upload04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { SITE_IMAGE_UPLOAD_ACCEPT } from "@notra/sites-core/constants/uploads";
import { Input } from "@notra/ui/components/ui/input";
import { Spinner } from "@notra/ui/components/ui/spinner";
import { cn } from "@notra/ui/lib/utils";
import { useRef } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { ContentAuthorAvatar } from "@/components/content/overview/overview-author-select";
import { useSiteAssetPreview } from "@/lib/hooks/use-site-asset-preview";
import { useSiteImageUpload } from "@/lib/hooks/use-site-image-upload";
import type { SiteAuthorAvatarFieldProps } from "@/types/site-authors";

/** An author's avatar: upload, drop or paste an image, or type a path or URL. */
export function SiteAuthorAvatarField({
  id,
  name,
  value,
  onChange,
  aria,
}: SiteAuthorAvatarFieldProps) {
  const t = useTranslations("sites.design.authors.dialog");
  const upload = useSiteImageUpload("logo", onChange);
  const src = useSiteAssetPreview(value, upload.preview);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex items-center gap-4 rounded-lg transition-shadow",
          upload.dragging && "ring-ring/50 ring-2 ring-offset-4"
        )}
        {...upload.dropTarget}
      >
        <div className="relative shrink-0">
          <ContentAuthorAvatar
            author={{ name: name || "?", avatarUrl: src }}
            className="size-16"
          />
          {upload.uploading ? (
            <span className="bg-background/70 absolute inset-0 flex items-center justify-center rounded-full">
              <Spinner className="size-4" />
            </span>
          ) : null}
        </div>
        {upload.enabled ? (
          <div className="min-w-0 space-y-2">
            <input
              accept={SITE_IMAGE_UPLOAD_ACCEPT}
              aria-hidden="true"
              className="sr-only"
              id={`${id}-file`}
              onChange={(event) => {
                void upload.upload(event.target.files?.[0]);
                event.target.value = "";
              }}
              ref={fileRef}
              tabIndex={-1}
              type="file"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                aria-busy={upload.uploading}
                disabled={upload.uploading}
                onClick={() => fileRef.current?.click()}
                size="sm"
                type="button"
                variant="outline"
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={Upload04Icon}
                  strokeWidth={1.8}
                />
                {value ? t("avatarReplace") : t("avatarUpload")}
              </Button>
              {value ? (
                <Button
                  disabled={upload.uploading}
                  onClick={() => onChange("")}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {t("avatarRemove")}
                </Button>
              ) : null}
            </div>
            <p className="text-muted-foreground text-xs">{t("avatarDrop")}</p>
          </div>
        ) : null}
      </div>
      <Input
        {...aria}
        aria-label={t("avatarPathLabel")}
        autoComplete="off"
        id={id}
        maxLength={300}
        onChange={(event) => onChange(event.target.value)}
        onPaste={upload.onPaste}
        placeholder={t("avatarPlaceholder")}
        spellCheck={false}
        value={value}
      />
    </div>
  );
}
