"use client";

import {
  ImageCompositionIcon,
  ImageUploadIcon,
  Layout01Icon,
  Share08Icon,
  Sun03Icon,
  Tag01Icon,
  TextFontIcon,
  TextIcon,
} from "@hugeicons/core-free-icons";
import { Input } from "@notra/ui/components/ui/input";
import { useTranslations } from "use-intl";

import { SiteAssetField } from "@/components/sites/site-asset-field";
import { useSite } from "@/components/sites/site-context";
import { SiteOptionSelect } from "@/components/sites/site-option-select";
import {
  SiteSettingsItem,
  SiteSettingsSwitchItem,
} from "@/components/sites/site-settings-item";
import { SiteThumbnailLayoutSketch } from "@/components/sites/site-thumbnail-layout-sketch";
import { useSiteWorkspace } from "@/components/sites/site-workspace-context";
import {
  SITE_THUMBNAIL_APPEARANCES,
  SITE_THUMBNAIL_LAYOUTS,
} from "@/constants/site-share-image";
import type {
  SiteDesignFieldsProps,
  SiteDesignForm,
} from "@/types/site-design";
import { defaultShareLabel } from "@/utils/site-design";

export function SiteShareImageFields({
  form,
  update,
}: SiteDesignFieldsProps<SiteDesignForm>) {
  const t = useTranslations("sites.design.shareImages");
  const { detail } = useSite();
  const workspace = useSiteWorkspace();
  const generated = form.thumbnailsEnabled;
  return (
    <>
      <SiteSettingsSwitchItem
        checked={generated}
        description={t("generateHint")}
        icon={ImageCompositionIcon}
        onCheckedChange={(checked) => update("thumbnailsEnabled", checked)}
        title={t("generate")}
      />
      {generated ? (
        <>
          <SiteSettingsItem
            description={t("layoutHint")}
            errorPath="thumbnails.layout"
            icon={Layout01Icon}
            title={t("layout")}
            value={
              <SiteOptionSelect
                describe={(value) => t(`layoutDescriptions.${value}`)}
                label={t("layout")}
                onChange={(value) => update("thumbnailLayout", value)}
                options={SITE_THUMBNAIL_LAYOUTS.map((value) => ({
                  value,
                  label: t(`layouts.${value}`),
                }))}
                preview={(value) => (
                  <SiteThumbnailLayoutSketch
                    accent={
                      form.thumbnailAppearance === "dark"
                        ? form.darkModeAccent || form.primary
                        : form.primary
                    }
                    appearance={form.thumbnailAppearance}
                    layout={value}
                  />
                )}
                value={form.thumbnailLayout}
              />
            }
          />
          <SiteSettingsItem
            description={t("appearanceHint")}
            errorPath="thumbnails.appearance"
            icon={Sun03Icon}
            title={t("appearance")}
            value={
              <SiteOptionSelect
                label={t("appearance")}
                onChange={(value) => update("thumbnailAppearance", value)}
                options={SITE_THUMBNAIL_APPEARANCES.map((value) => ({
                  value,
                  label: t(`appearances.${value}`),
                }))}
                value={form.thumbnailAppearance}
              />
            }
          />
          <SiteSettingsItem
            description={t(
              form.thumbnailLayout === "author"
                ? "backgroundHintAuthor"
                : "backgroundHint"
            )}
            errorPath="thumbnails.background"
            icon={ImageUploadIcon}
            title={t("background")}
            value={
              <SiteAssetField
                id="site-thumbnail-background"
                kind="share"
                label={t("background")}
                onChange={(value) => update("thumbnailBackground", value)}
                placeholder="/images/og-background.png"
                value={form.thumbnailBackground}
              />
            }
          />
          {form.thumbnailLayout === "default" ? null : (
            <SiteSettingsItem
              description={t(
                form.thumbnailLayout === "article"
                  ? "labelHintArticle"
                  : "labelHint"
              )}
              errorPath="thumbnails.label"
              icon={Tag01Icon}
              title={t("label")}
              value={
                <Input
                  aria-label={t("label")}
                  autoComplete="off"
                  className="w-full"
                  maxLength={40}
                  onChange={(event) =>
                    update("thumbnailLabel", event.target.value)
                  }
                  placeholder={defaultShareLabel(
                    workspace?.config ?? {},
                    detail.site.mounts
                  )}
                  value={form.thumbnailLabel}
                />
              }
            />
          )}
          <SiteSettingsItem
            description={t("fontHint")}
            errorPath="thumbnails.font"
            icon={TextFontIcon}
            title={t("font")}
            value={
              <Input
                aria-label={t("font")}
                autoComplete="off"
                className="w-full"
                maxLength={80}
                onChange={(event) =>
                  update("thumbnailFont", event.target.value)
                }
                placeholder="/fonts/brand.ttf"
                spellCheck={false}
                value={form.thumbnailFont}
              />
            }
          />
        </>
      ) : null}
      <SiteSettingsItem
        description={t("homeImageHint")}
        errorPath="seo.image"
        icon={Share08Icon}
        title={t("homeImage")}
        value={
          <SiteAssetField
            id="site-share-image"
            kind="share"
            label={t("homeImage")}
            onChange={(value) => update("shareImage", value)}
            placeholder="/images/share.png"
            value={form.shareImage}
          />
        }
      />
      {form.shareImage.trim() ? (
        <SiteSettingsItem
          description={t("homeImageAltHint")}
          errorPath="seo.imageAlt"
          icon={TextIcon}
          title={t("homeImageAlt")}
          value={
            <Input
              aria-label={t("homeImageAlt")}
              autoComplete="off"
              className="w-full"
              maxLength={200}
              onChange={(event) => update("shareImageAlt", event.target.value)}
              placeholder={t("homeImageAltPlaceholder")}
              value={form.shareImageAlt}
            />
          }
        />
      ) : null}
    </>
  );
}
