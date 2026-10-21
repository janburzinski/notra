"use client";

import { Image01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@notra/ui/components/ui/input-group";
import { useState } from "react";

import { useSite } from "@/components/sites/site-context";
import type { SiteAssetFieldProps } from "@/types/site-design";
import { siteAssetUrl } from "@/utils/site-design";

export function SiteAssetField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: SiteAssetFieldProps) {
  const { site } = useSite().detail;
  const src = siteAssetUrl(site.liveUrl, value);
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = src !== null && failed !== src;
  return (
    <InputGroup className="w-full sm:w-80">
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
        placeholder={placeholder}
        spellCheck={false}
        value={value}
      />
    </InputGroup>
  );
}
