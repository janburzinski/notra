"use client";

import { Alert02Icon, Analytics01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  c15tSchema,
  siteIntegrationSchemas,
} from "@notra/sites-core/schemas/site-integrations";
import type { SiteIntegrationName } from "@notra/sites-core/types/site-integrations";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@notra/ui/components/ui/alert";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { SiteConsentSection } from "@/components/sites/site-consent-section";
import { SiteIntegrationDialog } from "@/components/sites/site-integration-dialog";
import { SiteIntegrationRow } from "@/components/sites/site-integration-row";
import {
  SiteSettingsGroup,
  SiteSettingsList,
} from "@/components/sites/site-settings-item";
import { useSiteWorkspace } from "@/components/sites/site-workspace-context";
import { SITE_INTEGRATION_PROVIDERS } from "@/constants/site-integrations";
import {
  useSaveSiteIntegration,
  useSiteIntegrations,
} from "@/lib/hooks/use-site-integrations";
import { toErrorMessage } from "@/utils/error-message";
import { siteIntegrationSettings } from "@/utils/site-integrations";

/**
 * Integrations show blog.json as committed on the production branch. Saving
 * opens a pull request instead of a draft, so Design tab drafts stay apart.
 */
export function SiteDesignIntegrations() {
  const t = useTranslations("sites.integrationsPage");
  const scope = useSiteWorkspace()!.scope;
  const query = useSiteIntegrations(scope);
  const save = useSaveSiteIntegration(scope);
  const [openId, setOpenId] = useState<SiteIntegrationName | null>(null);
  const busy = save.isPending;
  const c15t = c15tSchema.safeParse(query.data?.integrations.c15t);
  const open = SITE_INTEGRATION_PROVIDERS.find(
    (provider) => provider.id === openId
  );

  return (
    <div className="space-y-8">
      {query.isError ? (
        <Alert>
          <HugeiconsIcon
            aria-hidden="true"
            icon={Alert02Icon}
            strokeWidth={1.5}
          />
          <AlertTitle>{t("loadFailed")}</AlertTitle>
          <AlertDescription>
            <p>{t("loadFailedDescription")}</p>
            <Button
              disabled={query.isFetching}
              onClick={() => query.refetch()}
              size="sm"
              variant="outline"
            >
              {t("retry")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {query.data?.invalid ? (
        <Alert variant="warning">
          <HugeiconsIcon
            aria-hidden="true"
            icon={Alert02Icon}
            strokeWidth={1.5}
          />
          <AlertTitle>{t("invalidTitle")}</AlertTitle>
          <AlertDescription>{t("invalidDescription")}</AlertDescription>
        </Alert>
      ) : null}

      <SiteSettingsGroup icon={Analytics01Icon} title={t("analyticsTitle")}>
        <SiteSettingsList>
          {SITE_INTEGRATION_PROVIDERS.map((provider) => (
            <SiteIntegrationRow
              description={t(`providers.${provider.id}`)}
              loading={query.isPending}
              isSetUp={
                siteIntegrationSchemas[provider.id].safeParse(
                  query.data?.integrations[provider.id]
                ).success
              }
              disabled={query.isError || busy}
              key={provider.id}
              onOpen={() => setOpenId(provider.id)}
              onRemove={() =>
                save.mutate(
                  { provider: provider.id, settings: null },
                  {
                    onSuccess: ({ pullRequestUrl }) =>
                      pullRequestUrl
                        ? toast.success(t("pullRequestOpened"), {
                            description: t("pullRequestOpenedDescription"),
                            action: {
                              label: t("viewPullRequest"),
                              onClick: () =>
                                window.open(
                                  pullRequestUrl,
                                  "_blank",
                                  "noopener,noreferrer"
                                ),
                            },
                          })
                        : toast.info(t("alreadySaved")),
                    onError: (error) =>
                      toast.error(toErrorMessage(error, t("saveFailed"))),
                  }
                )
              }
              provider={provider}
            />
          ))}
        </SiteSettingsList>
      </SiteSettingsGroup>

      <SiteConsentSection
        disabled={query.isPending || query.isError || busy}
        loading={query.isPending}
        settings={c15t.success ? c15t.data : null}
      />

      {open ? (
        <SiteIntegrationDialog
          key={`${scope.siteId}:${open.id}`}
          onOpenChange={(next) => {
            if (!next) {
              setOpenId(null);
            }
          }}
          open
          provider={open}
          scope={scope}
          settings={siteIntegrationSettings(query.data?.integrations, open)}
        />
      ) : null}
    </div>
  );
}
