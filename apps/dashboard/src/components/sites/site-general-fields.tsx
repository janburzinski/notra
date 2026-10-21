"use client";

import { Tag01Icon, TextAlignLeftIcon } from "@hugeicons/core-free-icons";
import { Input } from "@notra/ui/components/ui/input";
import { Textarea } from "@notra/ui/components/ui/textarea";
import { useTranslations } from "use-intl";

import {
  SiteSettingsBlock,
  SiteSettingsItem,
} from "@/components/sites/site-settings-item";
import type {
  SiteDesignFieldsProps,
  SiteDesignForm,
} from "@/types/site-design";

export function SiteGeneralFields({
  form,
  update,
}: SiteDesignFieldsProps<SiteDesignForm>) {
  const t = useTranslations("sites.design.general");
  return (
    <>
      <SiteSettingsItem
        description={t("nameHint")}
        icon={Tag01Icon}
        title={t("name")}
        value={
          <Input
            aria-label={t("name")}
            autoComplete="off"
            className="w-full sm:w-80"
            maxLength={80}
            onChange={(event) => update("name", event.target.value)}
            value={form.name}
          />
        }
      />
      <SiteSettingsBlock
        description={t("descriptionHint")}
        icon={TextAlignLeftIcon}
        title={t("description")}
      >
        <Textarea
          aria-label={t("description")}
          maxLength={300}
          onChange={(event) => update("description", event.target.value)}
          placeholder={t("descriptionPlaceholder")}
          rows={3}
          value={form.description}
        />
      </SiteSettingsBlock>
    </>
  );
}
