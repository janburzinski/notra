"use client";

import { preferredGeoLanguage } from "@notra/geo-core/utils/geo-locale-language";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import { useForm, useStore } from "@tanstack/react-form";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { GeoLanguagePicker } from "@/components/geo/geo-language-picker";
import { GeoProjectBrandSelection } from "@/components/geo/project-brand-selection";
import {
  useAnalyzeBrand,
  useBrandAnalysisProgress,
  useBrandSettings,
  useCreateBrandVoice,
} from "@/lib/hooks/use-brand-analysis";
import { useGeoProjectsDb } from "@/lib/hooks/use-geo-db";
import type {
  GeoProjectCreateDialogProps,
  GeoProjectCreateFormValues,
} from "@/types/geo";
import {
  projectBrandIdentityName,
  projectWebsiteUrl,
  resolveProjectBrandSelection,
} from "@/utils/geo-projects";

function browserGeoLanguages(): string[] {
  return [
    preferredGeoLanguage(
      typeof navigator === "undefined" ? null : navigator.languages
    ),
  ];
}

export function GeoProjectCreateDialog({
  open,
  onOpenChange,
  organizationId,
  onCreated,
}: GeoProjectCreateDialogProps) {
  const t = useTranslations("geo.projectCreateDialog");
  const tCommon2 = useTranslations("common");
  const tCommon = useTranslations("common.actions");
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const { createProject } = useGeoProjectsDb(organizationId, { enabled: open });
  const brandQuery = useBrandSettings(organizationId, { enabled: open });
  const createIdentity = useCreateBrandVoice(organizationId);
  const { startPolling } = useBrandAnalysisProgress(organizationId);
  const analyzeIdentity = useAnalyzeBrand(organizationId, startPolling);
  const defaultValues: GeoProjectCreateFormValues = {
    name: "",
    website: "",
    selectedBrandSettingsId: null,
    languages: browserGeoLanguages(),
  };
  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      const websiteUrl = projectWebsiteUrl(value.website);
      const voices = brandQuery.data?.voices ?? [];
      const { matches, selectedIdentity } = resolveProjectBrandSelection(
        value.website,
        voices,
        value.selectedBrandSettingsId,
        createIdentity.data?.voice
      );
      if (!websiteUrl || !value.name.trim()) {
        setError(t("invalidInput"));
        return;
      }
      if (!brandQuery.isSuccess || (matches.length > 1 && !selectedIdentity)) {
        setError(t("chooseIdentity"));
        return;
      }

      setError(null);
      try {
        let brandSettingsId = selectedIdentity?.id;
        if (!brandSettingsId) {
          const { voice } = await createIdentity.mutateAsync({
            name: projectBrandIdentityName(value.name, voices),
            websiteUrl,
          });
          brandSettingsId = voice.id;
          form.setFieldValue("selectedBrandSettingsId", voice.id);
        }
        const project = await createProject({
          name: value.name.trim(),
          brandSettingsId,
          languages: value.languages,
        });
        if (
          !selectedIdentity ||
          createIdentity.data?.voice.id === brandSettingsId
        ) {
          await analyzeIdentity
            .mutateAsync({ url: websiteUrl, voiceId: brandSettingsId })
            .catch(() => {
              toast.error(t("analysisFailed"));
            });
        }
        reset();
        onOpenChange(false);
        onCreated(project.id);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : tCommon2("labels.failedToCreateProject")
        );
      }
    },
  });
  const values = useStore(form.store, (state) => state.values);
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const websiteUrl = projectWebsiteUrl(values.website);
  const identityName = projectBrandIdentityName(
    values.name,
    brandQuery.data?.voices ?? []
  );
  const { matches, selectedIdentity } = resolveProjectBrandSelection(
    values.website,
    brandQuery.data?.voices ?? [],
    values.selectedBrandSettingsId,
    createIdentity.data?.voice
  );

  const reset = () => {
    form.reset(
      { ...defaultValues, languages: browserGeoLanguages() },
      { keepDefaultValues: true }
    );
    setError(null);
    createIdentity.reset();
  };

  return (
    <ResponsiveDialog
      onOpenChange={(next) => {
        if (isSubmitting) {
          return;
        }
        if (!next) {
          reset();
        }
        onOpenChange(next);
      }}
      open={open}
    >
      <ResponsiveDialogContent className="sm:max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {tCommon2("labels.newProject")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t("description")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.state.isSubmitting) {
              void form.handleSubmit();
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={`${id}-website`}>
              {tCommon2("labels.website")}
            </Label>
            <Input
              autoComplete="url"
              disabled={isSubmitting}
              id={`${id}-website`}
              inputMode="url"
              onChange={(event) => {
                form.setFieldValue("website", event.target.value);
                form.setFieldValue("selectedBrandSettingsId", null);
                setError(null);
              }}
              placeholder="example.com"
              required
              value={values.website}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-name`}>{t("nameLabel")}</Label>
            <Input
              disabled={isSubmitting}
              id={`${id}-name`}
              onChange={(event) =>
                form.setFieldValue("name", event.target.value)
              }
              placeholder="Acme"
              required
              value={values.name}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-languages`}>
              {tCommon2("labels.languages")}
            </Label>
            <GeoLanguagePicker
              disabled={isSubmitting}
              inputId={`${id}-languages`}
              labeled={false}
              onChange={(next) => form.setFieldValue("languages", next)}
              selected={values.languages}
            />
          </div>
          {websiteUrl && brandQuery.isSuccess ? (
            <GeoProjectBrandSelection
              disabled={isSubmitting}
              identities={matches}
              onSelect={(next) =>
                form.setFieldValue("selectedBrandSettingsId", next)
              }
              projectName={identityName}
              selectedIdentity={selectedIdentity}
            />
          ) : null}
          {brandQuery.isError ? (
            <p className="text-destructive text-sm" role="alert">
              {t("loadIdentitiesFailed")}{" "}
              <button
                className="underline"
                onClick={() => brandQuery.refetch()}
                type="button"
              >
                {tCommon("tryAgain")}
              </button>
            </p>
          ) : null}
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          {error && createIdentity.isSuccess ? (
            <p className="text-muted-foreground text-sm">
              {t("identitySaved")}
            </p>
          ) : null}
          <ResponsiveDialogFooter>
            <Button
              disabled={isSubmitting}
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
              type="button"
              variant="outline"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              disabled={!brandQuery.isSuccess}
              loading={isSubmitting}
              type="submit"
              data-dialog-confirm
            >
              {t("create")}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
