"use client";

import { Image01Icon, Upload04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { SITE_IMAGE_UPLOAD_ACCEPT } from "@notra/sites-core/constants/uploads";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@notra/ui/components/ui/input-group";
import { Spinner } from "@notra/ui/components/ui/spinner";
import { cn } from "@notra/ui/lib/utils";
import { useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { useSiteAssetPreview } from "@/lib/hooks/use-site-asset-preview";
import { useSiteImageUpload } from "@/lib/hooks/use-site-image-upload";
import type { SiteAssetFieldProps } from "@/types/site-design";

export function SiteAssetField({
  id,
  kind,
  label,
  value,
  onChange,
  placeholder,
}: SiteAssetFieldProps) {
  const t = useTranslations("sites.design.asset");
  const upload = useSiteImageUpload(kind, onChange);
  const src = useSiteAssetPreview(value, upload.preview);
  const inputRef = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = src !== null && failed !== src;

  return (
    <div
      className={cn(
        "w-full rounded-md transition-shadow",
        upload.dragging && "ring-ring/50 ring-2"
      )}
      {...upload.dropTarget}
    >
      <InputGroup className="w-full">
        <InputGroupAddon>
          <span className="bg-muted/60 ring-foreground/10 flex size-5 items-center justify-center overflow-hidden rounded-[5px] ring-1">
            {showImage ? (
              <img
                alt=""
                className="size-full object-contain"
                onError={() => setFailed(src)}
                src={src}
              />
            ) : (
              <HugeiconsIcon
                aria-hidden="true"
                className="text-muted-foreground size-3"
                icon={Image01Icon}
              />
            )}
          </span>
        </InputGroupAddon>
        <InputGroupInput
          aria-label={label}
          autoComplete="off"
          className="font-mono text-xs"
          id={id}
          maxLength={300}
          onChange={(event) => onChange(event.target.value)}
          onPaste={upload.onPaste}
          placeholder={placeholder}
          spellCheck={false}
          value={value}
        />
        {upload.enabled ? (
          <InputGroupAddon align="inline-end">
            <input
              accept={SITE_IMAGE_UPLOAD_ACCEPT}
              aria-hidden="true"
              className="sr-only"
              onChange={(event) => {
                void upload.upload(event.target.files?.[0]);
                event.target.value = "";
              }}
              ref={inputRef}
              tabIndex={-1}
              type="file"
            />
            <InputGroupButton
              aria-label={t("uploadLabel", { label })}
              disabled={upload.uploading}
              onClick={() => inputRef.current?.click()}
              size="xs"
            >
              {upload.uploading ? (
                <Spinner className="size-3" />
              ) : (
                <HugeiconsIcon
                  aria-hidden="true"
                  className="size-3.5"
                  icon={Upload04Icon}
                  strokeWidth={1.8}
                />
              )}
              {upload.uploading ? t("uploading") : t("upload")}
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    </div>
  );
}
