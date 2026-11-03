"use client";

import {
  Heading01Icon,
  Home01Icon,
  TextAlignLeftIcon,
} from "@hugeicons/core-free-icons";
import { Input } from "@notra/ui/components/ui/input";
import { Textarea } from "@notra/ui/components/ui/textarea";
import { useTranslations } from "use-intl";

import {
  SiteSettingsItem,
  SiteSettingsSwitchItem,
} from "@/components/sites/site-settings-item";
import type {
  SiteDesignFieldsProps,
  SiteDesignForm,
} from "@/types/site-design";

export function SiteNotFoundFields({
  form,
  update,
}: SiteDesignFieldsProps<SiteDesignForm>) {
  const t = useTranslations("sites.design.notFound");
  return (
    <>
      <SiteSettingsItem
        description={t("titleHint")}
        errorPath="errors.404.title"
        icon={Heading01Icon}
        title={t("title")}
        value={
          <Input
            aria-label={t("title")}
            autoComplete="off"
            className="w-full"
            maxLength={120}
            onChange={(event) => update("notFoundTitle", event.target.value)}
            placeholder={t("titlePlaceholder")}
            value={form.notFoundTitle}
          />
        }
      />
      <SiteSettingsItem
        description={t("descriptionHint")}
        errorPath="errors.404.description"
        icon={TextAlignLeftIcon}
        title={t("description")}
        value={
          <Textarea
            aria-label={t("description")}
            maxLength={300}
            onChange={(event) =>
              update("notFoundDescription", event.target.value)
            }
            placeholder={t("descriptionPlaceholder")}
            rows={3}
            value={form.notFoundDescription}
          />
        }
      />
      <SiteSettingsSwitchItem
        checked={form.notFoundRedirect}
        description={t("redirectHint")}
        icon={Home01Icon}
        onCheckedChange={(checked) => update("notFoundRedirect", checked)}
        title={t("redirect")}
      />
    </>
  );
}
