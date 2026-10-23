"use client";

import { LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { Input } from "@notra/ui/components/ui/input";
import { useTranslations } from "use-intl";

import { SiteSeparateAssetRows } from "@/components/sites/site-separate-asset-rows";
import { SiteSettingsItem } from "@/components/sites/site-settings-item";
import type {
  SiteDesignFieldsProps,
  SiteDesignForm,
} from "@/types/site-design";

export function SiteBrandingFields({
  form,
  update,
}: SiteDesignFieldsProps<SiteDesignForm>) {
  const t = useTranslations("sites.design.branding");
  return (
    <>
      <SiteSeparateAssetRows
        dark={form.logoDark}
        description={t("logoHint")}
        id="site-logo"
        kind="logo"
        light={form.logoLight}
        onDarkChange={(value) => update("logoDark", value)}
        onLightChange={(value) => update("logoLight", value)}
        onSeparateChange={(value) => update("separateLogos", value)}
        placeholder="/logo/light.svg"
        separate={form.separateLogos}
        separateLabel={t("separateLogos")}
        title={t("logo")}
      />
      <SiteSettingsItem
        description={t("logoHrefHint")}
        icon={LinkSquare02Icon}
        errorPath="logo.href"
        title={t("logoHref")}
        value={
          <Input
            aria-label={t("logoHref")}
            autoComplete="off"
            className="w-full sm:w-80"
            onChange={(event) => update("logoHref", event.target.value)}
            placeholder="https://example.com"
            spellCheck={false}
            value={form.logoHref}
          />
        }
      />
      <SiteSeparateAssetRows
        dark={form.faviconDark}
        description={t("faviconHint")}
        id="site-favicon"
        kind="favicon"
        light={form.faviconLight}
        onDarkChange={(value) => update("faviconDark", value)}
        onLightChange={(value) => update("faviconLight", value)}
        onSeparateChange={(value) => update("separateFavicons", value)}
        placeholder="/favicon.svg"
        separate={form.separateFavicons}
        separateLabel={t("separateFavicons")}
        title={t("favicon")}
      />
    </>
  );
}
