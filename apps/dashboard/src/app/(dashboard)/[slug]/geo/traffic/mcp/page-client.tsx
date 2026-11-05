"use client";

import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { AnalyticsSourceTabs } from "@/components/analytics/analytics-source-tabs";
import { EmptyState } from "@/components/empty-state";
import { GeoRangePicker } from "@/components/geo/geo-range-picker";
import { PageContainer } from "@/components/layout/container";
import { McpEmpty } from "@/components/mcp/mcp-empty";
import { McpRequestSheet } from "@/components/mcp/mcp-request-sheet";
import {
  McpAnalyticsHero,
  McpAudienceSections,
  McpLoadFailed,
  McpRequestLog,
  McpServerRequestSections,
  McpToolSections,
} from "@/components/mcp/mcp-sections";
import { McpSessionSheet } from "@/components/mcp/mcp-session-sheet";
import { McpToolSheet } from "@/components/mcp/mcp-tool-sheet";
import { McpVersionSelect } from "@/components/mcp/mcp-version-select";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { SkeletonCrossfade } from "@/components/skeleton-crossfade";
import { useGeoIngestSetup } from "@/lib/hooks/use-geo";
import { useGeoRange } from "@/lib/hooks/use-geo-range";
import { useMcpAnalytics } from "@/lib/hooks/use-mcp-analytics";
import { useMcpVersionQuery } from "@/lib/hooks/use-mcp-version";
import type {
  McpAnalyticsPageProps,
  McpRequestLogEntry,
  McpSessionSummary,
} from "@/types/mcp-analytics";
import { mcpSessionAverages } from "@/utils/mcp-analytics";

import { McpTrafficSkeleton } from "./skeleton";

export default function McpAnalyticsPage({
  organizationSlug,
}: McpAnalyticsPageProps) {
  const t = useTranslations("geo.pages");
  const [selectedRequest, setSelectedRequest] =
    useState<McpRequestLogEntry | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [selectedToolName, setSelectedToolName] = useState<string | null>(null);
  const [toolOpen, setToolOpen] = useState(false);
  const [selectedSession, setSelectedSession] =
    useState<McpSessionSummary | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const { getOrganization, activeOrganization } = useOrganizationsContext();
  const organization =
    activeOrganization?.slug === organizationSlug
      ? activeOrganization
      : getOrganization(organizationSlug);
  const organizationId = organization?.id ?? "";
  const geoRange = useGeoRange();
  const { data, isPending, isPlaceholderData, isError, refetch } =
    useMcpAnalytics(organizationId, geoRange.query);
  const [serverVersion] = useMcpVersionQuery();
  const {
    data: ingestSetup,
    isError: isIngestSetupError,
    refetch: refetchIngestSetup,
  } = useGeoIngestSetup(organizationId);
  // While a new range loads, the previous response stays on screen; chart it
  // against the range it was fetched for, not the one still loading.
  const [dataRange, setDataRange] = useState(geoRange.query);
  if (
    data &&
    !isPlaceholderData &&
    (dataRange.from !== geoRange.query.from ||
      dataRange.to !== geoRange.query.to)
  ) {
    setDataRange(geoRange.query);
  }

  // A version filter with no traffic is an empty result, not a missing setup.
  const hasData =
    data &&
    (data.totals.requests + data.requests.length > 0 || !!serverVersion);
  // A quiet period after earlier traffic is not a missing setup either.
  const hasPreviousData = (data?.totals.previousRequests ?? 0) > 0;
  const selectedTool =
    data?.tools.find((tool) => tool.name === selectedToolName) ?? null;
  const openTool = (name: string) => {
    const known = data?.tools.some((tool) => tool.name === name) ?? false;
    setSelectedToolName(known ? name : null);
    setToolOpen(known);
  };

  return (
    <SkeletonCrossfade
      loading={isPending}
      skeleton={<McpTrafficSkeleton geoRange={geoRange} />}
    >
      <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="w-full min-w-0 space-y-6 px-4 lg:px-6">
          <PageHeading
            description={t("mcp.description")}
            title={t("traffic.title")}
          >
            <div className="flex min-h-8 max-w-full flex-wrap items-center gap-3">
              <McpVersionSelect versions={data?.versions ?? []} />
              <GeoRangePicker control={geoRange} />
            </div>
          </PageHeading>
          <AnalyticsSourceTabs />

          {isError && !data ? <McpLoadFailed onRetry={refetch} /> : null}
          {!isError && !hasData && hasPreviousData ? (
            <EmptyState
              description={t("mcp.emptyRangeDescription")}
              title={t("mcp.emptyTitle")}
            />
          ) : null}
          {!isError && !hasData && !hasPreviousData ? (
            <McpEmpty
              onRetrySetup={() => refetchIngestSetup()}
              setup={ingestSetup}
              setupFailed={isIngestSetupError}
            />
          ) : null}
          {data && hasData ? (
            <>
              <McpAnalyticsHero data={data} range={dataRange} />
              <McpToolSections data={data} onOpenTool={openTool} />
              <McpAudienceSections
                data={data}
                onOpenSession={(session) => {
                  setSelectedSession(session);
                  setSessionOpen(true);
                }}
                onOpenTool={openTool}
              />
              <McpServerRequestSections data={data} onOpenTool={openTool} />
              <McpRequestLog
                data={data}
                onOpenRequest={(entry) => {
                  setSelectedRequest(entry);
                  setRequestOpen(true);
                }}
              />
            </>
          ) : null}
        </div>
        <McpToolSheet
          onOpenChange={setToolOpen}
          onSelectTool={openTool}
          open={toolOpen}
          organizationId={organizationId}
          range={geoRange.query}
          tool={selectedTool}
        />
        <McpSessionSheet
          averages={data ? mcpSessionAverages(data) : null}
          onOpenChange={setSessionOpen}
          open={sessionOpen}
          organizationId={organizationId}
          range={geoRange.query}
          session={selectedSession}
        />
        <McpRequestSheet
          entry={selectedRequest}
          onOpenChange={setRequestOpen}
          open={requestOpen}
        />
      </PageContainer>
    </SkeletonCrossfade>
  );
}
