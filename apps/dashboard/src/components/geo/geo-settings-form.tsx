"use client";

import { DEFAULT_LANGUAGE } from "@notra/ai/constants/languages";
import {
  GEO_CONVERSION_PATHS_PLACEHOLDER,
  GEO_MAX_ALIASES,
  GEO_MAX_CONVERSION_PATHS,
  GEO_MAX_DOMAINS,
  GEO_PROJECT_DOMAINS_PLACEHOLDER,
  GEO_SCAN_DEFAULT_INTERVAL_HOURS,
  GEO_SETTINGS_AUTO_SAVE_MS,
} from "@notra/geo-core/constants/geo";
import type { GeoSettingsUpsertInput } from "@notra/geo-core/types/geo";
import { normalizeConversionPaths } from "@notra/geo-core/utils/geo-conversion-paths";
import { trackedGeoLanguages } from "@notra/geo-core/utils/geo-language-rows";
import { geoDefaultEngines } from "@notra/geo-core/utils/geo-model-catalog";
import { extraProjectDomains } from "@notra/geo-core/utils/geo-project-domains";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Badge } from "@notra/ui/components/ui/badge";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import { TitleCard } from "@notra/ui/components/ui/title-card";
import { useAsyncDebouncer } from "@tanstack/react-pacer";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { GeoEnginePicker } from "@/components/geo/geo-engine-picker";
import { GeoLanguagePicker } from "@/components/geo/geo-language-picker";
import { GeoScanFrequencyMenu } from "@/components/geo/geo-scan-schedule";
import { GeoTagList } from "@/components/geo/geo-tag-list";
import { GeoProjectBrandSection } from "@/components/geo/project-brand-section";
import { useGeoSettingsUpsert } from "@/lib/hooks/use-geo";
import { useGeoActiveProject } from "@/lib/hooks/use-geo-active-project";
import { useLanguageLabel } from "@/lib/hooks/use-language-label";
import { useHasZdrEntitlement } from "@/lib/hooks/use-plan";
import type {
  GeoBrandSectionProps,
  GeoLanguagesSectionProps,
  GeoModelsSectionProps,
  GeoSettingsAutosaveInput,
  GeoSettingsFormProps,
} from "@/types/geo";
import { inferGeoAudience } from "@/utils/geo-engine-recommendation";

export function GeoSettingsForm({
  organizationId,
  settings,
  catalog,
  hideHeader = false,
  section,
}: GeoSettingsFormProps) {
  const t = useTranslations("geo.geoSettingsForm");
  const tCommon = useTranslations("common");
  const id = useId();
  const [companyName, setCompanyName] = useState(
    () => settings?.companyName ?? ""
  );
  const [aliases, setAliases] = useState(() => settings?.aliases ?? []);
  const [conversionPaths, setConversionPaths] = useState(() =>
    normalizeConversionPaths(settings?.conversionPaths ?? [])
  );
  const { project, domain: brandDomain } = useGeoActiveProject(organizationId);
  const [domains, setDomains] = useState(() =>
    extraProjectDomains(settings?.domains ?? [], brandDomain)
  );
  const extraDomains = extraProjectDomains(domains, brandDomain);
  const [competitors] = useState(() => settings?.competitors ?? []);
  const [languages, setLanguages] = useState(() =>
    trackedGeoLanguages(settings?.languages ?? [])
  );
  const [engines, setEngines] = useState<string[]>(
    () => settings?.engines ?? geoDefaultEngines(catalog)
  );
  const [enforceZdr, setEnforceZdr] = useState(
    () => settings?.enforceZdr ?? true
  );
  const [nonZdrApproved, setNonZdrApproved] = useState<string[]>(
    () => settings?.nonZdrApprovedEngines ?? []
  );
  const [enabled, setEnabled] = useState(() => settings?.enabled ?? true);
  const [scanIntervalHours, setScanIntervalHours] = useState(
    () => settings?.scanIntervalHours ?? GEO_SCAN_DEFAULT_INTERVAL_HOURS
  );
  const { hasZdr: canEnforceZdr, isLoading: planLoading } =
    useHasZdrEntitlement();
  const nameMissing = companyName.trim().length === 0;
  const { savedAt } = useGeoSettingsAutosave({
    aliases,
    brandDomain,
    canEnforceZdr,
    catalog,
    companyName,
    competitors,
    conversionPaths,
    domains: extraDomains,
    enabled,
    engines,
    enforceZdr,
    languages,
    nonZdrApproved,
    organizationId,
    planLoading,
    scanIntervalHours,
    settings,
  });

  const showBrand = section === undefined || section === "brand";
  const showModels = section === undefined || section === "models";

  return (
    <div className="w-full space-y-6">
      {hideHeader ? null : (
        <PageHeading
          description={t("description")}
          title={tCommon("labels.geoSettings")}
        />
      )}
      <div className="space-y-6">
        {showBrand && project ? (
          <GeoProjectBrandSection
            key={project.id}
            organizationId={organizationId}
            project={project}
          />
        ) : null}
        {showBrand ? (
          <GeoBrandSection
            aliases={aliases}
            brandDomain={brandDomain}
            companyName={companyName}
            conversionPaths={conversionPaths}
            domains={extraDomains}
            id={id}
            nameMissing={nameMissing}
            onAliasesChange={setAliases}
            onCompanyNameChange={setCompanyName}
            onConversionPathsChange={(values) =>
              setConversionPaths(normalizeConversionPaths(values))
            }
            onDomainsChange={(values) =>
              setDomains(extraProjectDomains(values, brandDomain))
            }
            savedAt={savedAt}
          />
        ) : null}
        {showBrand ? (
          <GeoLanguagesSection
            languages={languages}
            onLanguagesChange={setLanguages}
            promptLanguage={settings?.promptLanguage}
          />
        ) : null}
        {showModels ? (
          <GeoModelsSection
            canEnforceZdr={canEnforceZdr}
            catalog={catalog}
            enabled={enabled}
            engines={engines}
            enforceZdr={enforceZdr}
            nonZdrApproved={nonZdrApproved}
            onEnabledChange={setEnabled}
            onEnginesChange={setEngines}
            onEnforceZdrChange={setEnforceZdr}
            onNonZdrApprovedChange={setNonZdrApproved}
            onScanIntervalHoursChange={setScanIntervalHours}
            planLoading={planLoading}
            scanIntervalHours={scanIntervalHours}
          />
        ) : null}
      </div>
    </div>
  );
}

function useGeoSettingsAutosave({
  aliases,
  brandDomain,
  canEnforceZdr,
  catalog,
  companyName,
  competitors,
  conversionPaths,
  domains,
  enabled,
  engines,
  enforceZdr,
  languages,
  nonZdrApproved,
  organizationId,
  planLoading,
  scanIntervalHours,
  settings,
}: GeoSettingsAutosaveInput) {
  const upsert = useGeoSettingsUpsert(organizationId, { silentSuccess: true });
  const [savedAt, setSavedAt] = useState<Date | null>(() =>
    settings?.updatedAt ? new Date(settings.updatedAt) : null
  );
  const lastSaved = useRef<string | undefined>(undefined);
  const debouncer = useAsyncDebouncer(
    async (input: GeoSettingsUpsertInput) => {
      await upsert.mutateAsync(input);
      lastSaved.current = JSON.stringify(input);
      setSavedAt(new Date());
    },
    {
      wait: GEO_SETTINGS_AUTO_SAVE_MS,
      throwOnError: false,
    },
    (state) => ({
      isExecuting: state.isExecuting,
      isPending: state.isPending,
    })
  );
  const debouncerRef = useRef(debouncer);

  useEffect(() => {
    debouncerRef.current = debouncer;
  }, [debouncer]);

  useEffect(() => {
    if (planLoading) {
      return;
    }

    const input: GeoSettingsUpsertInput = toGeoSettingsPayload({
      organizationId,
      companyName,
      aliases,
      competitors,
      conversionPaths,
      domains,
      languages,
      engines,
      enforceZdr,
      nonZdrApprovedEngines: nonZdrApproved,
      enabled,
      scanIntervalHours,
      canEnforceZdr,
    });
    const serialized = JSON.stringify(input);
    const runner = debouncerRef.current;

    if (lastSaved.current === undefined) {
      lastSaved.current = JSON.stringify(
        toGeoSettingsPayload({
          organizationId,
          companyName: settings?.companyName ?? "",
          aliases: settings?.aliases ?? [],
          competitors: settings?.competitors ?? [],
          conversionPaths: normalizeConversionPaths(
            settings?.conversionPaths ?? []
          ),
          domains: extraProjectDomains(settings?.domains ?? [], brandDomain),
          languages: trackedGeoLanguages(settings?.languages ?? []),
          engines: settings?.engines ?? geoDefaultEngines(catalog),
          enforceZdr: settings?.enforceZdr ?? true,
          nonZdrApprovedEngines: settings?.nonZdrApprovedEngines ?? [],
          enabled: settings?.enabled ?? true,
          scanIntervalHours:
            settings?.scanIntervalHours ?? GEO_SCAN_DEFAULT_INTERVAL_HOURS,
          canEnforceZdr,
        })
      );
    }

    if (input.companyName.length === 0) {
      runner.cancel();
      return;
    }

    if (serialized === lastSaved.current) {
      runner.cancel();
      return;
    }

    runner.maybeExecute(input).catch(() => undefined);
  }, [
    aliases,
    brandDomain,
    catalog,
    companyName,
    competitors,
    conversionPaths,
    domains,
    enabled,
    engines,
    enforceZdr,
    canEnforceZdr,
    languages,
    nonZdrApproved,
    organizationId,
    planLoading,
    scanIntervalHours,
    settings,
  ]);

  useEffect(() => {
    return () => {
      debouncerRef.current.flush().catch(() => undefined);
    };
  }, []);

  return {
    isSaving: debouncer.state.isPending || debouncer.state.isExecuting,
    savedAt,
  };
}

function toGeoSettingsPayload({
  canEnforceZdr,
  ...input
}: GeoSettingsUpsertInput & {
  canEnforceZdr: boolean;
}): GeoSettingsUpsertInput {
  return {
    ...input,
    companyName: input.companyName.trim(),
    enforceZdr: canEnforceZdr && input.enforceZdr,
  };
}

function GeoBrandSection({
  aliases,
  brandDomain,
  companyName,
  conversionPaths,
  domains,
  id,
  nameMissing,
  onAliasesChange,
  onCompanyNameChange,
  onConversionPathsChange,
  onDomainsChange,
  savedAt,
}: GeoBrandSectionProps) {
  const t = useTranslations("geo.geoSettingsForm");
  const tCommon = useTranslations("common");
  return (
    <>
      <TitleCard as="section" heading={tCommon("labels.brand")} headingAs="h2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-name`}>
              {tCommon("labels.companyName")}
            </Label>
            <p className="text-muted-foreground text-xs">
              {t("brand.companyNameHint")}
            </p>
            <Input
              aria-invalid={nameMissing && savedAt !== null}
              id={`${id}-name`}
              onChange={(event) => onCompanyNameChange(event.target.value)}
              placeholder="Notra"
              value={companyName}
            />
          </div>
          <GeoTagList
            description={t("brand.aliasesHint")}
            id={`${id}-aliases`}
            label={t("brand.aliases")}
            max={GEO_MAX_ALIASES}
            onChange={onAliasesChange}
            placeholder="usenotra"
            values={aliases}
          />
        </div>
      </TitleCard>
      <TitleCard as="section" heading={t("website.title")} headingAs="h2">
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{t("domains.title")}</p>
              <p className="text-muted-foreground text-xs text-pretty">
                {t("domains.description")}
              </p>
            </div>
            {brandDomain ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  aria-label={t("domains.brandWebsiteLabel", {
                    domain: brandDomain,
                  })}
                  className="h-7 max-w-full text-xs"
                  variant="secondary"
                >
                  <span className="truncate">{brandDomain}</span>
                </Badge>
                <p className="text-muted-foreground text-xs">
                  {t("domains.brandWebsiteHint")}
                </p>
              </div>
            ) : null}
            <GeoTagList
              id={`${id}-domains`}
              label={t("domains.title")}
              labeled={false}
              max={GEO_MAX_DOMAINS}
              onChange={onDomainsChange}
              placeholder={GEO_PROJECT_DOMAINS_PLACEHOLDER}
              values={domains}
            />
          </div>
          <GeoTagList
            description={t("conversionPaths.description")}
            id={`${id}-conversion-paths`}
            label={t("conversionPaths.title")}
            max={GEO_MAX_CONVERSION_PATHS}
            onChange={onConversionPathsChange}
            placeholder={GEO_CONVERSION_PATHS_PLACEHOLDER}
            values={conversionPaths}
          />
        </div>
      </TitleCard>
    </>
  );
}

function GeoModelsSection({
  canEnforceZdr,
  catalog,
  enabled,
  engines,
  enforceZdr,
  nonZdrApproved,
  onEnabledChange,
  onEnginesChange,
  onEnforceZdrChange,
  onNonZdrApprovedChange,
  onScanIntervalHoursChange,
  planLoading,
  scanIntervalHours,
}: GeoModelsSectionProps) {
  // Onboarding seeds the engines from the audience it detects on the brand's
  // website, so the tracked engines tell us who the buyers are.
  const [audience] = useState(() => inferGeoAudience(catalog, engines));

  return (
    <GeoEnginePicker
      audience={audience}
      canEnforceZdr={canEnforceZdr}
      catalog={catalog}
      enforceZdr={enforceZdr}
      nonZdrApproved={nonZdrApproved}
      onChange={onEnginesChange}
      onEnforceZdrChange={onEnforceZdrChange}
      onNonZdrApprovedChange={onNonZdrApprovedChange}
      planLoading={planLoading}
      menu={
        <GeoScanFrequencyMenu
          enabled={enabled}
          intervalHours={scanIntervalHours}
          onEnabledChange={onEnabledChange}
          onIntervalChange={onScanIntervalHoursChange}
        />
      }
      selected={engines}
    />
  );
}

function GeoLanguagesSection({
  languages,
  onLanguagesChange,
  promptLanguage,
}: GeoLanguagesSectionProps) {
  const t = useTranslations("geo.geoSettingsForm");
  const tCommon = useTranslations("common");
  const languageLabel = useLanguageLabel();
  return (
    <TitleCard
      as="section"
      heading={tCommon("labels.languages")}
      headingAs="h2"
    >
      <div className="space-y-3">
        <p className="text-muted-foreground text-xs text-pretty">
          {t("languages.description", {
            language: languageLabel(promptLanguage ?? DEFAULT_LANGUAGE),
          })}
        </p>
        <GeoLanguagePicker
          labeled={false}
          lockedLanguage={promptLanguage}
          onChange={onLanguagesChange}
          selected={languages}
        />
      </div>
    </TitleCard>
  );
}
