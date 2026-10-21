"use client";

import { useState } from "react";
import { useTranslations } from "use-intl";

import { SiteIntegrationRow } from "@/components/sites/site-integration-row";
import { SiteInthDialog } from "@/components/sites/site-inth-dialog";
import { INTH_PROVIDER } from "@/constants/site-consent";
import { useSearchParams } from "@/lib/navigation";
import type { SiteConsentSectionProps } from "@/types/components/sites";
import { inthOAuthError } from "@/utils/site-consent";

export function SiteConsentSection({
  branch,
  isSetUp,
  loading,
  disabled,
}: SiteConsentSectionProps) {
  const t = useTranslations("sites.integrationsPage.consent");
  const searchParams = useSearchParams();
  const oauthError = inthOAuthError(searchParams.get("error"));
  const [open, setOpen] = useState(
    () => oauthError !== null || searchParams.has("inthConnected")
  );

  return (
    <section className="space-y-3" aria-labelledby="site-consent-heading">
      <h2 className="font-medium" id="site-consent-heading">
        {t("title")}
      </h2>
      <div className="grid grid-cols-1 gap-x-6 gap-y-1 lg:grid-cols-2">
        <SiteIntegrationRow
          description={t("description")}
          disabled={disabled}
          isSetUp={isSetUp}
          loading={loading}
          onOpen={() => setOpen(true)}
          provider={INTH_PROVIDER}
        />
      </div>
      <SiteInthDialog
        branch={branch}
        isSetUp={isSetUp}
        oauthError={oauthError}
        onOpenChange={setOpen}
        open={open}
      />
    </section>
  );
}
