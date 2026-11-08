"use client";

import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { POST_AUTHORS_MAX } from "@notra/ai/constants/post-metadata";
import { AvatarGroup } from "@notra/ui/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@notra/ui/components/ui/select";
import { useTranslations } from "use-intl";

import { ContentAuthorAvatar } from "@/components/content/overview/overview-author-select";
import Link from "@/components/framework/link";
import { AUTHOR_AVATAR_STACK_MAX } from "@/constants/content-overview";
import { useContentAuthors } from "@/lib/hooks/use-content-authors";
import type { OverviewSiteAuthorSelectProps } from "@/types/site-authors";
import { siteAuthorRef, siteAuthorRefId } from "@/utils/site-author-refs";
import { siteAuthorSelection } from "@/utils/site-authors";
import { siteAssetUrl } from "@/utils/site-design";

/**
 * Authors for a post on a Sites site come from that site's blog.json. The
 * post stores their ids and publishing writes `author: <id>`.
 */
export function OverviewSiteAuthorSelect({
  organizationId,
  site,
  authors,
  authorIds,
  addHref,
  onChange,
}: OverviewSiteAuthorSelectProps) {
  const t = useTranslations("content.overview.authors");
  const { authors: contentAuthors } = useContentAuthors(organizationId);
  const siteIds = new Set(authors.map((entry) => entry.id));
  const value = siteAuthorSelection(authorIds, contentAuthors, siteIds);
  const selectedValues = new Set(value);
  const contentAuthorsById = new Map(
    contentAuthors.map((author) => [author.id, author])
  );
  const options = [
    ...authors.map((entry) => ({
      value: siteAuthorRef(entry.id),
      name: entry.author.name,
      avatarUrl: entry.author.avatar
        ? siteAssetUrl(site.liveUrl, entry.author.avatar)
        : null,
      detail: entry.author.title ?? null,
    })),
    // Keep what the post already names visible, so nothing is dropped silently.
    ...value.flatMap((selected) => {
      const id = siteAuthorRefId(selected);
      if (id) {
        return siteIds.has(id)
          ? []
          : [
              {
                value: selected,
                name: id,
                avatarUrl: null,
                detail: t("missing"),
              },
            ];
      }
      const author = contentAuthorsById.get(selected);
      return author
        ? [
            {
              value: selected,
              name: author.name,
              avatarUrl: author.avatarUrl,
              detail: t("notraAuthor"),
            },
          ]
        : [];
    }),
  ];
  const selected = options.filter((option) => selectedValues.has(option.value));

  return (
    <div className="space-y-1.5">
      <Select
        multiple
        onValueChange={(next) =>
          onChange((next as string[]).slice(0, POST_AUTHORS_MAX))
        }
        value={value}
      >
        <SelectTrigger aria-label={t("label")} className="w-full">
          {selected.length > 0 ? (
            <span className="flex min-w-0 items-center gap-2">
              <AvatarGroup className="shrink-0">
                {selected.slice(0, AUTHOR_AVATAR_STACK_MAX).map((author) => (
                  <ContentAuthorAvatar author={author} key={author.value} />
                ))}
              </AvatarGroup>
              <span className="truncate">
                {selected.length > 2
                  ? `${selected[0]?.name}, +${selected.length - 1}`
                  : selected.map((author) => author.name).join(", ")}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{t("placeholder")}</span>
          )}
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          {options.length === 0 ? (
            <p className="text-muted-foreground px-2 py-1.5 text-sm">
              {t("siteEmpty")}
            </p>
          ) : null}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <ContentAuthorAvatar author={option} />
              <span className="truncate">{option.name}</span>
              {option.detail ? (
                <span className="text-muted-foreground ms-auto truncate ps-2 text-xs">
                  {option.detail}
                </span>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground min-w-0 truncate text-xs">
          {selected.length === 0
            ? t("fallback")
            : t("fromSite", { site: site.name })}
        </p>
        <Link
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex shrink-0 items-center gap-1 rounded-sm text-xs outline-none focus-visible:ring-2"
          href={addHref}
        >
          <HugeiconsIcon
            aria-hidden="true"
            className="size-3"
            icon={Add01Icon}
          />
          {t("addSiteAuthor")}
        </Link>
      </div>
    </div>
  );
}
