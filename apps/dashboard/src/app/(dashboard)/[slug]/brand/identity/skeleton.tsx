"use client";

import {
  Add01Icon,
  Bookmark02Icon,
  Building03Icon,
  HierarchyFilesIcon,
  PaintBoardIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import {
  IconTabsList,
  IconTabsTrigger,
} from "@notra/ui/components/ui/icon-tabs";
import { Kbd } from "@notra/ui/components/ui/kbd";
import { Label } from "@notra/ui/components/ui/label";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { Tabs } from "@notra/ui/components/ui/tabs";
import { TitleCard } from "@notra/ui/components/ui/title-card";
import { useQueryState } from "nuqs";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { PageContainer } from "@/components/layout/container";
import { cn } from "@/lib/utils";
import type { BrandSkeletonFieldProps } from "@/types/brand-identity";
import { brandIdentityViewParser } from "@/utils/brand-identity-search-params";

/** Mirrors the selected tab so its content lands where the skeleton was. */
export function BrandIdentityPageSkeleton() {
  const t = useTranslations("brand.identity.form");
  const tTabs = useTranslations("brand.identity.tabs");
  const tCommon = useTranslations("common");
  const tBrandShared = useTranslations("brand.shared");
  const tHeader = useTranslations("brand.identity.header.tabs");
  const [view] = useQueryState(
    "view",
    brandIdentityViewParser.withDefault("identity")
  );
  const actionLabel = {
    identity: tBrandShared("createIdentity"),
    references: tBrandShared("addReference"),
    sitemap: tBrandShared("addSitemap"),
    guidelines: null,
  }[view];
  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-5 px-4 lg:px-6">
        <PageHeading
          description={tHeader(`${view}.description`)}
          title={tCommon("labels.brandIdentity")}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {actionLabel ? (
              <Button disabled size="sm">
                <HugeiconsIcon className="size-4" icon={Add01Icon} />
                {actionLabel}
                <Kbd className="ml-1 hidden sm:inline-flex">C</Kbd>
              </Button>
            ) : (
              <>
                <Skeleton className="h-7 w-32 rounded-lg" />
                <Skeleton className="h-7 w-40 rounded-lg" />
              </>
            )}
            <Skeleton className="size-7 rounded-lg" />
          </div>
        </PageHeading>
        <Tabs value={view}>
          <div className="max-w-full min-w-0 overflow-x-auto pb-2">
            <IconTabsList aria-label={tTabs("label")} value={view}>
              <IconTabsTrigger
                disabled
                icon={<HugeiconsIcon icon={Building03Icon} size={15} />}
                value="identity"
              >
                {tCommon("labels.companyInfo")}
              </IconTabsTrigger>
              <IconTabsTrigger
                disabled
                icon={<HugeiconsIcon icon={PaintBoardIcon} size={15} />}
                value="guidelines"
              >
                {tTabs("guidelines")}
              </IconTabsTrigger>
              <IconTabsTrigger
                disabled
                icon={<HugeiconsIcon icon={Bookmark02Icon} size={15} />}
                value="references"
              >
                {tCommon("labels.references")}
              </IconTabsTrigger>
              <IconTabsTrigger
                disabled
                icon={<HugeiconsIcon icon={HierarchyFilesIcon} size={15} />}
                value="sitemap"
              >
                {tCommon("labels.sitemap")}
              </IconTabsTrigger>
            </IconTabsList>
          </div>
          {view === "identity" ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <TitleCard heading={t("companyProfileHeading")}>
                <div className="space-y-6">
                  <SkeletonField label={tCommon("labels.companyName")} />
                  <SkeletonField label={tCommon("labels.website")} />
                  <SkeletonField label={tCommon("labels.description")} tall />
                </div>
              </TitleCard>
              <TitleCard
                action={<Skeleton className="h-7 w-[8.25rem] rounded-lg" />}
                heading={t("toneLanguageHeading")}
              >
                <div className="space-y-6">
                  <SkeletonField label={t("customToneLabel")} tall />
                  <SkeletonField label={tCommon("labels.language")} />
                </div>
              </TitleCard>
              <TitleCard
                className="lg:col-span-2"
                heading={t("customInstructionsLabel")}
              >
                <Skeleton className="h-24 w-full rounded-md" />
              </TitleCard>
              <TitleCard
                className="lg:col-span-2"
                heading={t("audienceHeading")}
              >
                <SkeletonField label={t("audienceLabel")} tall />
              </TitleCard>
            </div>
          ) : (
            <Skeleton className="mt-6 h-96 w-full rounded-2xl" />
          )}
        </Tabs>
      </div>
    </PageContainer>
  );
}

function SkeletonField({ label, tall = false }: BrandSkeletonFieldProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Skeleton className={cn("w-full rounded-md", tall ? "h-24" : "h-8")} />
    </div>
  );
}
