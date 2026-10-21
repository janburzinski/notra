"use client";

import {
  Image01Icon,
  Menu01Icon,
  PaintBrush01Icon,
  Settings02Icon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { useTranslations } from "use-intl";

import { SiteBrandingFields } from "@/components/sites/site-branding-fields";
import { SiteDesignEditor } from "@/components/sites/site-design-editor";
import { SiteGeneralFields } from "@/components/sites/site-general-fields";
import { SiteNavbarFields } from "@/components/sites/site-navbar-fields";
import {
  SiteSettingsGroup,
  SiteSettingsList,
} from "@/components/sites/site-settings-item";
import { SiteStylingFields } from "@/components/sites/site-styling-fields";
import { SiteTypographyFields } from "@/components/sites/site-typography-fields";
import type { SiteDesignForm, SiteTypographyMode } from "@/types/site-design";
import {
  applyBrandToDesign,
  describeBrandForDesign,
  patchDesign,
  readDesignForm,
} from "@/utils/site-design";

export function SiteDesignPage() {
  const t = useTranslations("sites.design");
  return (
    <div className="space-y-8">
      <PageHeading description={t("description")} title={t("title")} />
      <SiteDesignEditor<SiteDesignForm>
        applyBrand={applyBrandToDesign}
        describeBrand={describeBrandForDesign}
        patch={patchDesign}
        read={readDesignForm}
      >
        {(form, update) => (
          <>
            <SiteSettingsGroup
              icon={Settings02Icon}
              title={t("groups.general")}
            >
              <SiteSettingsList>
                <SiteGeneralFields form={form} update={update} />
              </SiteSettingsList>
            </SiteSettingsGroup>
            <SiteSettingsGroup icon={Image01Icon} title={t("groups.branding")}>
              <SiteSettingsList>
                <SiteBrandingFields form={form} update={update} />
              </SiteSettingsList>
            </SiteSettingsGroup>
            <SiteSettingsGroup
              icon={PaintBrush01Icon}
              title={t("groups.styling")}
            >
              <SiteStylingFields form={form} update={update} />
            </SiteSettingsGroup>
            <SiteSettingsGroup
              action={
                <Tabs
                  onValueChange={(mode: SiteTypographyMode) => {
                    if (mode === form.typographyMode) {
                      return;
                    }
                    update("typographyMode", mode);
                    if (mode === "pair") {
                      update("body", form.font);
                    } else {
                      update("font", form.body);
                    }
                  }}
                  value={form.typographyMode}
                >
                  <TabsList aria-label={t("typography.modeLabel")}>
                    <TabsTrigger value="single">
                      {t("typography.modes.single")}
                    </TabsTrigger>
                    <TabsTrigger value="pair">
                      {t("typography.modes.pair")}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              }
              icon={TextFontIcon}
              title={t("groups.typography")}
            >
              <SiteSettingsList>
                <SiteTypographyFields form={form} update={update} />
              </SiteSettingsList>
            </SiteSettingsGroup>
            <SiteSettingsGroup icon={Menu01Icon} title={t("groups.navbar")}>
              <SiteSettingsList>
                <SiteNavbarFields form={form} update={update} />
              </SiteSettingsList>
            </SiteSettingsGroup>
          </>
        )}
      </SiteDesignEditor>
    </div>
  );
}
