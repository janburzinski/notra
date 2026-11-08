"use client";

import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { Button, buttonVariants } from "@/components/button";
import { ContentAuthorsDialog } from "@/components/content/overview/content-authors-dialog";
import { OverviewAuthorSelect } from "@/components/content/overview/overview-author-select";
import { OverviewField } from "@/components/content/overview/overview-field";
import { OverviewSiteAuthorSelect } from "@/components/content/overview/overview-site-author-select";
import Link from "@/components/framework/link";
import { SITE_AUTHOR_NEW_PARAM } from "@/constants/site-authors";
import { usePostAuthorSite } from "@/lib/hooks/use-post-author-site";
import type {
  OverviewAuthorsFieldProps,
  OverviewNotraAuthorsFieldProps,
  OverviewSiteAuthorsFieldProps,
} from "@/types/site-authors";
import { siteHref } from "@/utils/site-links";

/** A Sites post's authors come from the site's blog.json, managed in Design. */
function OverviewSiteAuthorsField({
  organizationId,
  organizationSlug,
  site,
  authors,
  authorIds,
  onChange,
}: OverviewSiteAuthorsFieldProps) {
  const t = useTranslations("content.overview");
  const href = `${siteHref(organizationSlug, site.id, "design")}?section=authors`;
  return (
    <OverviewField
      aside={
        <Link
          className={buttonVariants({
            className: "-my-1",
            size: "xs",
            variant: "ghost",
          })}
          href={href}
        >
          {t("authors.manage")}
        </Link>
      }
      hint={t("authors.siteHint")}
      label={t("authors.label")}
    >
      <OverviewSiteAuthorSelect
        addHref={`${href}&author=${SITE_AUTHOR_NEW_PARAM}`}
        authorIds={authorIds}
        authors={authors}
        onChange={onChange}
        organizationId={organizationId}
        site={site}
      />
    </OverviewField>
  );
}

function OverviewNotraAuthorsField({
  organizationId,
  authorIds,
  loading,
  onChange,
}: OverviewNotraAuthorsFieldProps) {
  const t = useTranslations("content.overview");
  const [open, setOpen] = useState(false);
  return (
    <OverviewField
      aside={
        <Button
          className="-my-1"
          disabled={loading}
          onClick={() => setOpen(true)}
          size="xs"
          variant="ghost"
        >
          {t("authors.manage")}
        </Button>
      }
      hint={t("authors.hint")}
      label={t("authors.label")}
    >
      {loading ? (
        <Skeleton className="h-8 w-full rounded-lg" />
      ) : (
        <OverviewAuthorSelect
          authorIds={authorIds}
          onChange={onChange}
          organizationId={organizationId}
        />
      )}
      <ContentAuthorsDialog
        onOpenChange={setOpen}
        open={open}
        organizationId={organizationId}
      />
    </OverviewField>
  );
}

export function OverviewAuthorsField({
  contentId,
  ...props
}: OverviewAuthorsFieldProps) {
  const { site, authors, loading } = usePostAuthorSite(
    props.organizationId,
    contentId
  );
  return site ? (
    <OverviewSiteAuthorsField {...props} authors={authors} site={site} />
  ) : (
    <OverviewNotraAuthorsField {...props} loading={loading} />
  );
}
