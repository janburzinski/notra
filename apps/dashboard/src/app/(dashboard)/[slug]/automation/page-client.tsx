"use client";

import {
  Add01Icon,
  AiBrowserIcon,
  Clock01Icon,
  GithubIcon,
  Task01Icon,
  ZapIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { InstrumentSection } from "@notra/ui/components/instrument/instrument-module";
import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Badge } from "@notra/ui/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@notra/ui/components/ui/empty";
import { Kbd } from "@notra/ui/components/ui/kbd";
import {
  SplitButton,
  SplitButtonTrigger,
} from "@notra/ui/components/ui/split-button";
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { AutomationLoadError } from "@/components/automation/automation-load-error";
import { AutomationTemplateGrid } from "@/components/automation/automation-template-gallery";
import { AutomationsTable } from "@/components/automation/automations-table";
import { OnboardingSuggestions } from "@/components/automation/onboarding-suggestions";
import { Button, buttonVariants } from "@/components/button";
import Link from "@/components/framework/link";
import { PageContainer } from "@/components/layout/container";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import {
  AUTOMATION_FILTERS,
  AUTOMATION_TEMPLATES,
  FEATURED_AUTOMATION_TEMPLATE_IDS,
} from "@/constants/automation-templates";
import { useAutomationMutations } from "@/lib/hooks/use-automation-mutations";
import { useAutomationRowName } from "@/lib/hooks/use-automation-row-name";
import { useAutomationRows } from "@/lib/hooks/use-automation-rows";
import { useLatestAutomationRuns } from "@/lib/hooks/use-automation-runs";
import { useSettingsModal } from "@/lib/hooks/use-settings-modal";
import { useRouter } from "@/lib/navigation";
import type {
  AutomationFilter,
  AutomationRow,
} from "@/types/automation/automations";
import { rowEnabled } from "@/utils/automation-rows";

import { AutomationPageSkeleton } from "./skeleton";

interface PageClientProps {
  organizationSlug: string;
}

function matchesFilter(row: AutomationRow, filter: AutomationFilter) {
  switch (filter) {
    case "content":
      return row.kind !== "alert";
    case "alerts":
      return row.kind === "alert";
    case "paused":
      return !rowEnabled(row);
    default:
      return true;
  }
}

export default function PageClient({ organizationSlug }: PageClientProps) {
  const t = useTranslations("automation.page");
  const { getOrganization } = useOrganizationsContext();
  const organizationId = getOrganization(organizationSlug)?.id;
  const { openSettings } = useSettingsModal();
  const router = useRouter();
  const nameOf = useAutomationRowName();
  const { toggle, remove, runNow, sendTest } =
    useAutomationMutations(organizationId);

  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [filter, setFilter] = useState<AutomationFilter>("all");
  const [deleteRow, setDeleteRow] = useState<AutomationRow | null>(null);

  useHotkey("C", () => setCreateMenuOpen(true), {
    enabled: !createMenuOpen,
  });

  const {
    rows,
    alerts: alertList,
    alertsReady,
    isPending,
    isError,
    isRefetching,
    refetch,
  } = useAutomationRows(organizationId);
  const latestRuns = useLatestAutomationRuns(organizationId);
  const lastRuns = new Map(Object.entries(latestRuns.data?.lastRunAt ?? {}));
  const visibleRows = rows.filter((row) => matchesFilter(row, filter));
  const counts = Object.fromEntries(
    AUTOMATION_FILTERS.map((item) => [
      item,
      rows.filter((row) => matchesFilter(row, item)).length,
    ])
  ) as Record<AutomationFilter, number>;

  const basePath = `/${organizationSlug}/automation`;
  const goToNew = (query = "") => router.push(`${basePath}/new${query}`);
  const featuredTemplates = FEATURED_AUTOMATION_TEMPLATE_IDS.flatMap((id) =>
    AUTOMATION_TEMPLATES.filter((template) => template.id === id)
  );

  const busyId =
    (toggle.isPending ? toggle.variables?.row.id : undefined) ??
    (remove.isPending ? remove.variables?.id : undefined) ??
    (runNow.isPending ? runNow.variables : undefined) ??
    (sendTest.isPending ? sendTest.variables : undefined);

  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-8 px-4 lg:px-6">
        <PageHeading description={t("description")} title={t("title")}>
          <div className="flex items-center gap-2">
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`${basePath}/runs`}
            >
              <HugeiconsIcon className="size-4" icon={Task01Icon} />
              {t("viewRuns")}
            </Link>
            <SplitButton>
              <Button onClick={() => goToNew()}>
                <HugeiconsIcon className="size-4" icon={Add01Icon} />
                {t("create")}
                <Kbd className="hidden sm:inline-flex">C</Kbd>
              </Button>
              <DropdownMenu
                onOpenChange={setCreateMenuOpen}
                open={createMenuOpen}
              >
                <SplitButtonTrigger label={t("createMore")} />
                <DropdownMenuContent align="end" className="w-64">
                  <CreateMenuItem
                    description={t("createMenu.alertHint")}
                    icon={AiBrowserIcon}
                    label={t("createMenu.alert")}
                    onClick={() => goToNew("?type=alert")}
                  />
                  <CreateMenuItem
                    description={t("createMenu.scheduleHint")}
                    icon={Clock01Icon}
                    label={t("createMenu.schedule")}
                    onClick={() => goToNew("?type=schedule")}
                  />
                  <CreateMenuItem
                    description={t("createMenu.eventHint")}
                    icon={GithubIcon}
                    label={t("createMenu.event")}
                    onClick={() => goToNew("?type=event")}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            </SplitButton>
          </div>
        </PageHeading>

        {organizationId ? (
          <>
            <OnboardingSuggestions
              onCreate={(suggestionId) => {
                goToNew(`?type=schedule&suggestion=${suggestionId}`);
              }}
              organizationId={organizationId}
              type="schedule_automation"
            />
            <OnboardingSuggestions
              onCreate={(suggestionId) => {
                goToNew(`?type=event&suggestion=${suggestionId}`);
              }}
              organizationId={organizationId}
              type="event_automation"
            />
          </>
        ) : null}

        {isPending ? <AutomationPageSkeleton /> : null}

        {isError ? (
          <AutomationLoadError
            kind="automations"
            onRetry={() => refetch()}
            retrying={isRefetching}
          />
        ) : null}

        {isPending || isError ? null : (
          <div className="space-y-3">
            {rows.length === 0 ? null : (
              <Tabs
                onValueChange={(value) => setFilter(value as AutomationFilter)}
                value={filter}
              >
                <TabsList aria-label={t("filterLabel")}>
                  {AUTOMATION_FILTERS.map((item) => (
                    <TabsTrigger key={item} value={item}>
                      {t(`filters.${item}`)}
                      <Badge size="sm" variant="secondary">
                        {counts[item]}
                      </Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}
            <AutomationsTable
              busyId={busyId}
              lastRuns={lastRuns}
              emptyState={
                rows.length === 0 ? (
                  <Empty className="py-0 md:py-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <HugeiconsIcon icon={ZapIcon} />
                      </EmptyMedia>
                      <EmptyTitle>{t("empty.title")}</EmptyTitle>
                      <EmptyDescription>
                        {t("empty.description")}
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button onClick={() => goToNew()} size="sm">
                        <HugeiconsIcon className="size-4" icon={Add01Icon} />
                        {t("create")}
                      </Button>
                    </EmptyContent>
                  </Empty>
                ) : (
                  t("emptyFilter")
                )
              }
              onDelete={setDeleteRow}
              onEdit={(row) => router.push(`${basePath}/${row.id}`)}
              onRunNow={(row) => runNow.mutate(row.id)}
              onSendTest={(row) => sendTest.mutate(row.id)}
              onToggle={(row, next) => toggle.mutate({ row, enabled: next })}
              onViewRuns={(row) =>
                router.push(`${basePath}/runs?automation=${row.id}`)
              }
              rows={visibleRows}
            />
          </div>
        )}

        <InstrumentSection
          action={
            <Link
              className="text-muted-foreground hover:text-foreground duration-fast text-sm transition-colors"
              href={`${basePath}/templates`}
            >
              {t("more")}
            </Link>
          }
          eyebrow={t("templatesTitle")}
        >
          <AutomationTemplateGrid
            alerts={alertsReady ? alertList : undefined}
            onOpenWebhooks={() => openSettings("webhooks")}
            organizationSlug={organizationSlug}
            templates={featuredTemplates}
          />
        </InstrumentSection>
      </div>

      <ConfirmDialog
        confirmLabel={t("delete")}
        description={t("deleteDescription", {
          name: deleteRow ? nameOf(deleteRow) : "",
        })}
        onConfirm={() => {
          if (deleteRow) {
            remove.mutate(deleteRow, { onSettled: () => setDeleteRow(null) });
          }
        }}
        onOpenChange={(open) => !open && setDeleteRow(null)}
        open={!!deleteRow}
        pending={remove.isPending}
        title={t("deleteTitle")}
        variant="destructive"
      />
    </PageContainer>
  );
}

function CreateMenuItem({
  description,
  icon,
  label,
  onClick,
}: {
  description: string;
  icon: typeof Add01Icon;
  label: string;
  onClick: () => void;
}) {
  return (
    <DropdownMenuItem className="items-start gap-2.5 py-2" onClick={onClick}>
      <HugeiconsIcon className="mt-0.5 size-4 shrink-0" icon={icon} />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-muted-foreground text-xs">{description}</span>
      </span>
    </DropdownMenuItem>
  );
}
