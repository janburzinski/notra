"use client";

import { AvatarImage } from "@notra/ui/components/ui/avatar";
import { useState } from "react";

import type { DomainLogoImageProps } from "@/types/components/domain-logo-image";
import { getDomainLogoSources } from "@/utils/domain-logo";

function DomainLogoImageInner({
  domain,
  fallback,
  onError,
  onLoad,
  onSettled,
  preferredSources,
  ...props
}: DomainLogoImageProps) {
  const sources = getDomainLogoSources(domain, preferredSources);
  const [sourceIndex, setSourceIndex] = useState(0);
  const src = sources[sourceIndex];

  if (!src) {
    return fallback;
  }

  return (
    <AvatarImage
      {...props}
      onError={(event) => {
        onError?.(event);
        if (sourceIndex + 1 < sources.length) {
          setSourceIndex((current) => current + 1);
          return;
        }
        onSettled?.();
        setSourceIndex(sources.length);
      }}
      onLoad={(event) => {
        onLoad?.(event);
        onSettled?.();
      }}
      src={src}
    />
  );
}

export function DomainLogoImage(props: DomainLogoImageProps) {
  const sourcesKey = getDomainLogoSources(
    props.domain,
    props.preferredSources
  ).join("\n");

  return <DomainLogoImageInner key={sourcesKey} {...props} />;
}
