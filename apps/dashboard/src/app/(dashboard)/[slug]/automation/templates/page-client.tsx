"use client";

import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";

import { AutomationLoadError } from "@/components/automation/automation-load-error";
import { AutomationTemplateGrid } from "@/components/automation/automation-template-gallery";
import Link from "@/components/framework/link";
import { PageContainer } from "@/components/layout/container";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import {
  AUTOMATION_TEMPLATE_CATEGORIES,
  AUTOMATION_TEMPLATES,
} from "@/constants/automation-templates";
import { useSettingsModal } from "@/lib/hooks/use-settings-modal";
import { dashboardOrpc } from "@/lib/orpc/query";

interface PageClientProps {
  organizationSlug: string;
}

export default function PageClient({ organizationSlug }: PageClientProps) {
  const t = useTranslations("automation.templates");
  const tEditor = useTranslations("automation.editor");
  const { getOrganization } = useOrganizationsContext();
  const organizationId = getOrganization(organizationSlug)?.id;
  const { openSettings } = useSettingsModal();
  const alerts = useQuery(
    dashboardOrpc.automation.alerts.list.queryOptions({
      input: { organizationId: organizationId ?? "" },
      enabled: !!organizationId,
    })
  );

  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-8 px-4 lg:px-6">
        <div className="space-y-4">
          <Link
            className="text-muted-foreground hover:text-foreground duration-fast inline-flex items-center gap-1 text-sm transition-colors"
            href={`/${organizationSlug}/automation`}
          >
            <HugeiconsIcon className="size-4" icon={ArrowLeft01Icon} />
            {tEditor("back")}
          </Link>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("title")}
            </h1>
            <p className="text-muted-foreground text-sm text-pretty">
              {t("description")}
            </p>
          </div>
        </div>
        {alerts.isError ? (
          <AutomationLoadError
            kind="automations"
            onRetry={() => alerts.refetch()}
            retrying={alerts.isFetching}
          />
        ) : null}
        {AUTOMATION_TEMPLATE_CATEGORIES.map((category) => (
          <section className="space-y-3" key={category}>
            <h2 className="text-muted-foreground text-sm font-medium">
              {t(`categories.${category}.title`)}
            </h2>
            <AutomationTemplateGrid
              alerts={alerts.isSuccess ? alerts.data.alerts : undefined}
              onOpenWebhooks={() => openSettings("webhooks")}
              organizationSlug={organizationSlug}
              templates={AUTOMATION_TEMPLATES.filter(
                (template) => template.category === category
              )}
            />
          </section>
        ))}
      </div>
    </PageContainer>
  );
}
