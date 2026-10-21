"use client";

import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { SiteBrandDialog } from "@/components/sites/site-brand-dialog";
import { SiteBrandingFields } from "@/components/sites/site-branding-fields";
import { SiteGeneralFields } from "@/components/sites/site-general-fields";
import { SiteNavbarFields } from "@/components/sites/site-navbar-fields";
import { SiteStylingFields } from "@/components/sites/site-styling-fields";
import { SiteTypographyFields } from "@/components/sites/site-typography-fields";
import { useSiteWorkspace } from "@/components/sites/site-workspace-context";
import { useSiteBrandDefaults } from "@/lib/hooks/use-site-brand-defaults";
import type {
  SiteDesignFieldsProps,
  SiteDesignForm,
} from "@/types/site-design";
import type { SiteDesignAppearanceProps } from "@/types/site-design-sections";
import {
  applyBrandToDesign,
  describeBrandForDesign,
  patchDesign,
  readDesignForm,
} from "@/utils/site-design";

export function SiteDesignAppearance({ section }: SiteDesignAppearanceProps) {
  const state = useSiteWorkspace()!;
  const [form, setForm] = useState(() => readDesignForm(state.config));
  const [snapshot, setSnapshot] = useState(state.document);
  const [brandOpen, setBrandOpen] = useState(false);
  const brand = useSiteBrandDefaults();
  const t = useTranslations("sites.design");
  if (snapshot !== state.document && !state.unsaved) {
    setSnapshot(state.document);
    setForm(readDesignForm(state.config));
  }
  const change = (next: SiteDesignForm) => {
    if (state.readOnly) {
      return;
    }
    state.update(patchDesign(state.config, next, form));
    setForm(next);
  };
  const update: SiteDesignFieldsProps<SiteDesignForm>["update"] = (
    key,
    value
  ) => change({ ...form, [key]: value });
  if (section === "styling") {
    return <SiteStylingFields form={form} update={update} />;
  }
  if (section === "branding") {
    return (
      <>
        {brand ? (
          <div className="flex justify-end pb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBrandOpen(true)}
            >
              {t("applyBrand")}
            </Button>
          </div>
        ) : null}
        <SiteBrandingFields form={form} update={update} />
        {brand ? (
          <SiteBrandDialog
            open={brandOpen}
            onOpenChange={setBrandOpen}
            changes={describeBrandForDesign(brand, form)}
            onConfirm={() => {
              change(applyBrandToDesign(brand, form));
              setBrandOpen(false);
            }}
          />
        ) : null}
      </>
    );
  }
  if (section === "typography") {
    return (
      <>
        <Tabs
          className="mb-4"
          value={form.typographyMode}
          onValueChange={(mode) => {
            if (mode === "single" || mode === "pair") {
              change({
                ...form,
                typographyMode: mode,
                ...(mode === "pair"
                  ? { body: form.font }
                  : { font: form.body }),
              });
            }
          }}
        >
          <TabsList aria-label={t("typography.modeLabel")}>
            <TabsTrigger value="single">
              {t("typography.modes.single")}
            </TabsTrigger>
            <TabsTrigger value="pair">{t("typography.modes.pair")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <SiteTypographyFields form={form} update={update} />
      </>
    );
  }
  if (section === "navbar") {
    return <SiteNavbarFields form={form} update={update} />;
  }
  return <SiteGeneralFields form={form} update={update} />;
}
