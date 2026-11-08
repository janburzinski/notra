"use client";

import { ContentAuthorAvatar } from "@/components/content/overview/overview-author-select";
import { useSiteAssetPreview } from "@/lib/hooks/use-site-asset-preview";
import type { SiteAuthorAvatarProps } from "@/types/site-authors";

/** A blog.json avatar, shown from its unpublished upload or the live site. */
export function SiteAuthorAvatar({
  name,
  avatar,
  className,
}: SiteAuthorAvatarProps) {
  const src = useSiteAssetPreview(avatar ?? "", null);
  return (
    <ContentAuthorAvatar
      author={{ name: name || "?", avatarUrl: src }}
      className={className}
    />
  );
}
