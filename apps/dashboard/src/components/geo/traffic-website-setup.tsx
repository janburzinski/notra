"use client";

import { Globe02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@notra/ui/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@notra/ui/components/ui/input-group";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { WebOutboundFavicon } from "@/components/geo/web-outbound-favicon";
import { SITE_DOMAIN_URL_SCHEME_PATTERN } from "@/constants/sites";
import {
  useBrandSettings,
  useCreateBrandVoice,
} from "@/lib/hooks/use-brand-analysis";
import { useGeoProjectsDb } from "@/lib/hooks/use-geo-db";
import { useGeoProjectQueryState } from "@/lib/hooks/use-geo-project-query";
import { dashboardOrpc } from "@/lib/orpc/query";
import { cn } from "@/lib/utils";
import type { TrafficWebsiteSetupProps } from "@/types/geo";
import { getWebsiteDomain } from "@/utils/brand";
import {
  projectBrandIdentityName,
  projectWebsiteUrl,
  resolveProjectBrandSelection,
} from "@/utils/geo-projects";

/**
 * The analytics empty state when the organization has no project yet: one
 * field for the website. Saves it as a project without GEO tracking, since the
 * tracker key and the domains it accepts both come from the project.
 */
export function TrafficWebsiteSetup({
  organizationId,
  description,
}: TrafficWebsiteSetupProps) {
  const t = useTranslations("geo.trafficWebsite");
  const id = useId();
  const brandQuery = useBrandSettings(organizationId);
  const createIdentity = useCreateBrandVoice(organizationId);
  const { createProject } = useGeoProjectsDb(organizationId);
  const [, setProjectParam] = useGeoProjectQueryState();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const voices = brandQuery.data?.voices ?? [];
  // Start from the brand identity's website when there is one.
  const value =
    draft ?? getWebsiteDomain(voices.at(0)?.websiteUrl ?? null) ?? "";
  const websiteUrl = projectWebsiteUrl(value);
  const domain = getWebsiteDomain(websiteUrl);

  const save = useMutation({
    mutationFn: async (site: { websiteUrl: string; domain: string }) => {
      const { matches } = resolveProjectBrandSelection(value, voices, null);
      const brandSettingsId =
        matches.at(0)?.id ??
        (
          await createIdentity.mutateAsync({
            name: projectBrandIdentityName(site.domain, voices),
            websiteUrl: site.websiteUrl,
          })
        ).voice.id;
      return createProject({
        name: site.domain,
        brandSettingsId,
        discover: false,
      });
    },
    onSuccess: async (project) => {
      // The tracker key and the accepted hosts now come from the project.
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.geo.key(),
      });
      await setProjectParam(project.id);
    },
    onError: () => setError(t("failed")),
  });
  const isSaving = save.isPending;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) {
      return;
    }
    if (!(websiteUrl && domain)) {
      setError(t("invalid"));
      return;
    }
    setError(null);
    save.mutate({ websiteUrl, domain });
  };

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={Globe02Icon} />
        </EmptyMedia>
        <EmptyTitle>{t("title")}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="max-w-md">
        <form
          className="flex w-full flex-col gap-2"
          noValidate
          onSubmit={submit}
        >
          <div className="flex w-full gap-2">
            <InputGroup className="flex-1">
              <InputGroupAddon>
                <WebOutboundFavicon
                  fallbackIcon={Globe02Icon}
                  url={domain ?? ""}
                />
              </InputGroupAddon>
              <InputGroupInput
                aria-describedby={`${id}-hint`}
                aria-invalid={error ? true : undefined}
                aria-label={t("label")}
                autoCapitalize="none"
                autoComplete="off"
                disabled={isSaving}
                inputMode="url"
                onChange={(event) => {
                  setDraft(
                    event.target.value.replace(
                      SITE_DOMAIN_URL_SCHEME_PATTERN,
                      ""
                    )
                  );
                  setError(null);
                }}
                placeholder="acme.com"
                spellCheck={false}
                value={value}
              />
            </InputGroup>
            <Button
              disabled={!(brandQuery.isSuccess && domain)}
              loading={isSaving}
              type="submit"
            >
              {t("submit")}
            </Button>
          </div>
          <p
            aria-live="polite"
            className={cn(
              "min-h-4 text-left text-xs text-pretty",
              error ? "text-destructive" : "text-muted-foreground"
            )}
            id={`${id}-hint`}
            role={error ? "alert" : undefined}
          >
            {error ?? (domain ? t("subdomains", { domain }) : null)}
          </p>
        </form>
      </EmptyContent>
    </Empty>
  );
}
