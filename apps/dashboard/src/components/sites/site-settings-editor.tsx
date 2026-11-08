"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { useSite } from "@/components/sites/site-context";
import { useUpdateSiteSettings } from "@/lib/hooks/use-update-site-settings";
import type {
  SiteSettingsEditorFooterProps,
  SiteSettingsEditorProps,
} from "@/types/components/site-settings";
import type { SiteSettingsForm } from "@/types/sites";
import {
  siteSettingsFormFromSite,
  siteSettingsPatch,
} from "@/utils/site-settings";

function SiteSettingsEditorFooter({
  canSave,
  isSaving,
  onCancel,
}: SiteSettingsEditorFooterProps) {
  const tCommon = useTranslations("common");
  return (
    <div className="flex justify-end gap-2">
      <Button
        disabled={isSaving}
        onClick={onCancel}
        size="sm"
        type="button"
        variant="ghost"
      >
        {tCommon("actions.cancel")}
      </Button>
      <Button disabled={!canSave} loading={isSaving} size="sm" type="submit">
        {tCommon("actions.save")}
      </Button>
    </div>
  );
}

export function SiteSettingsEditor({
  onDone,
  isValid,
  children,
}: SiteSettingsEditorProps) {
  const { site } = useSite().detail;
  const [base] = useState(site);
  const save = useUpdateSiteSettings({ onSaved: onDone });
  const canSaveValues = (values: SiteSettingsForm) =>
    Object.keys(siteSettingsPatch(values, base)).length > 0 &&
    (isValid?.(values) ?? true) &&
    !save.isPending;
  const form = useForm({
    defaultValues: siteSettingsFormFromSite(base),
    onSubmit: ({ value }) => {
      if (canSaveValues(value)) {
        save.mutate(siteSettingsPatch(value, base));
      }
    },
  });
  const values = useStore(form.store, (state) => state.values);
  const canSave = canSaveValues(values);

  return (
    <form className="space-y-4" action={() => form.handleSubmit()}>
      <fieldset className="max-w-xl space-y-4" disabled={save.isPending}>
        {children(values, (key, value) =>
          form.reset(
            { ...form.state.values, [key]: value },
            { keepDefaultValues: true }
          )
        )}
      </fieldset>
      <SiteSettingsEditorFooter
        canSave={canSave}
        isSaving={save.isPending}
        onCancel={onDone}
      />
    </form>
  );
}
