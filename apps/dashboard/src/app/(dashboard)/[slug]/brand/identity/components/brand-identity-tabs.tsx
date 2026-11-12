"use client";

import {
  Bookmark02Icon,
  Building03Icon,
  HierarchyFilesIcon,
  PaintBoardIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  IconTabsList,
  IconTabsTrigger,
} from "@notra/ui/components/ui/icon-tabs";
import { Tabs, TabsContent } from "@notra/ui/components/ui/tabs";
import { useTranslations } from "use-intl";

import type { BrandIdentityTabsProps, BrandTab } from "@/types/brand-identity";

import { BrandForm } from "./brand-form";
import { GuidelinesPanel } from "./guidelines-panel";
import { ReferencesList } from "./references-list";
import { SitemapList } from "./sitemap-list";

export function BrandIdentityTabs({
  activeTab,
  addReferenceOpen,
  addSitemapOpen,
  initialData,
  isSaving,
  onActiveTabChange,
  onAddReferenceOpenChange,
  onAddSitemapOpenChange,
  onSavingChange,
  organizationId,
  voiceId,
  voiceWebsiteUrl,
}: BrandIdentityTabsProps) {
  const t = useTranslations("brand.identity.tabs");
  const tCommon = useTranslations("common");
  const tStates = useTranslations("common.actions");
  return (
    <Tabs
      onValueChange={(value) => onActiveTabChange(value as BrandTab)}
      value={activeTab}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4">
        <div className="max-w-full min-w-0 overflow-x-auto pb-2">
          <IconTabsList aria-label={t("label")} value={activeTab}>
            <IconTabsTrigger
              icon={<HugeiconsIcon icon={Building03Icon} size={15} />}
              value="identity"
            >
              {tCommon("labels.companyInfo")}
            </IconTabsTrigger>
            <IconTabsTrigger
              icon={<HugeiconsIcon icon={PaintBoardIcon} size={15} />}
              value="guidelines"
            >
              {t("guidelines")}
            </IconTabsTrigger>
            <IconTabsTrigger
              icon={<HugeiconsIcon icon={Bookmark02Icon} size={15} />}
              value="references"
            >
              {tCommon("labels.references")}
            </IconTabsTrigger>
            <IconTabsTrigger
              icon={<HugeiconsIcon icon={HierarchyFilesIcon} size={15} />}
              value="sitemap"
            >
              {tCommon("labels.sitemap")}
            </IconTabsTrigger>
          </IconTabsList>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-3 pb-2">
          {activeTab === "identity" && isSaving ? (
            <span
              aria-live="polite"
              className="text-muted-foreground text-xs"
              role="status"
            >
              {tStates("saving")}
            </span>
          ) : null}
        </div>
      </div>

      <TabsContent className="mt-6" value="identity">
        <BrandForm
          initialData={initialData}
          key={voiceId}
          onSavingChange={onSavingChange}
          organizationId={organizationId}
          voiceId={voiceId}
        />
      </TabsContent>

      <TabsContent className="mt-6" value="guidelines">
        <GuidelinesPanel
          key={`guidelines-${voiceId}`}
          organizationId={organizationId}
          voiceId={voiceId}
        />
      </TabsContent>

      <TabsContent className="mt-6" value="references">
        <ReferencesList
          dialogOpen={addReferenceOpen}
          key={`refs-${voiceId}`}
          onDialogOpenChange={onAddReferenceOpenChange}
          organizationId={organizationId}
          voiceId={voiceId}
        />
      </TabsContent>

      <TabsContent className="mt-6" value="sitemap">
        <SitemapList
          dialogOpen={addSitemapOpen}
          key={`sitemap-${voiceId}`}
          onDialogOpenChange={onAddSitemapOpenChange}
          organizationId={organizationId}
          voiceId={voiceId}
          voiceWebsiteUrl={voiceWebsiteUrl}
        />
      </TabsContent>
    </Tabs>
  );
}
