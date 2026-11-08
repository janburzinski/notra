"use client";

import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { Disclosure } from "@/components/disclosure";
import { ANALYTICS_IMPORT_MIN_HOST_LENGTH } from "@/constants/analytics-imports";
import {
  useAnalyticsImportMutations,
  useAnalyticsImportSources,
} from "@/lib/hooks/use-analytics-imports";
import type {
  AnalyticsImportOverlapMode,
  AnalyticsImportPreview,
} from "@/types/analytics-imports";
import type { ImportSourceStepProps } from "@/types/components/analytics-import";
import { toErrorMessage } from "@/utils/error-message";

import { ImportHostField } from "./import-host-field";
import { ImportNotice } from "./import-notice";
import { ImportPreview, ImportPreviewFooter } from "./import-preview";

export function ImportSourceStep({
  organizationId,
  projectId,
  connectionId,
  defaultHost,
  onStarted,
  onReconnect,
}: ImportSourceStepProps) {
  const t = useTranslations("geo.analyticsImport");
  const sourceId = useId();
  const startId = useId();
  const endId = useId();
  const { data, isPending, error } = useAnalyticsImportSources(
    organizationId,
    connectionId
  );
  const { preview, create } = useAnalyticsImportMutations(organizationId);
  const [sourceKey, setSourceKey] = useState<string | null>(null);
  const [host, setHost] = useState(defaultHost);
  const [startDay, setStartDay] = useState("");
  const [endDay, setEndDay] = useState("");
  const [result, setResult] = useState<AnalyticsImportPreview | null>(null);
  const [overlap, setOverlap] = useState<AnalyticsImportOverlapMode>("skip");
  const sources = data?.sources ?? [];
  const keyOf = (source: (typeof sources)[number]) =>
    `${source.provider}:${source.ref}`;
  const selected = sources.find((source) => keyOf(source) === sourceKey);
  const items = sources.map((source) => ({
    value: keyOf(source),
    label: `${source.label} · ${t(`source.kinds.${source.kind}`)}`,
  }));
  const reconnect = (
    <Button onClick={onReconnect} size="sm" variant="outline">
      {t("source.reconnect")}
    </Button>
  );

  const input = selected
    ? {
        connectionId,
        projectId,
        provider: selected.provider,
        sourceRef: selected.ref,
        sourceLabel: selected.label,
        host: host.trim(),
        ...(startDay ? { startDay } : {}),
        ...(endDay ? { endDay } : {}),
      }
    : null;

  if (isPending) {
    return (
      <div aria-busy="true" className="flex flex-col gap-4">
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    );
  }
  if (error) {
    return (
      <ImportNotice
        action={reconnect}
        description={toErrorMessage(error, t("connect.failed"))}
        title={t("source.failed")}
        tone="destructive"
      />
    );
  }
  if (sources.length === 0) {
    return (
      <ImportNotice
        action={reconnect}
        description={t("source.none")}
        title={t("source.noneTitle")}
      />
    );
  }

  return (
    <>
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={sourceId}>{t("source.sourceLabel")}</Label>
          <Select
            items={items}
            onValueChange={(value) => {
              const next = sources.find((source) => keyOf(source) === value);
              setSourceKey(value as string);
              setResult(null);
              if (next?.host) {
                setHost(next.host);
              }
            }}
            value={sourceKey}
          >
            <SelectTrigger className="w-full" id={sourceId}>
              <SelectValue placeholder={t("source.sourcePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ImportHostField
          onChange={(value) => {
            setHost(value);
            setResult(null);
          }}
          value={host}
        />
        <Disclosure
          defaultOpen={Boolean(startDay || endDay)}
          label={t("source.range")}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={startId}>{t("source.startLabel")}</Label>
              <Input
                id={startId}
                onChange={(event) => {
                  setStartDay(event.target.value);
                  setResult(null);
                }}
                type="date"
                value={startDay}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={endId}>{t("source.endLabel")}</Label>
              <Input
                id={endId}
                onChange={(event) => {
                  setEndDay(event.target.value);
                  setResult(null);
                }}
                type="date"
                value={endDay}
              />
            </div>
          </div>
        </Disclosure>
        {result ? (
          <ImportPreview
            onOverlapChange={setOverlap}
            overlap={overlap}
            preview={result}
          />
        ) : null}
      </div>
      <ImportPreviewFooter
        canCheck={
          Boolean(input) &&
          host.trim().length >= ANALYTICS_IMPORT_MIN_HOST_LENGTH
        }
        checkLabel={t("source.preview")}
        checking={preview.isPending}
        onCheck={() => {
          if (!input) {
            return;
          }
          preview.mutate(input, {
            onSuccess: ({ preview: next }) => {
              setResult(next);
              setOverlap("skip");
            },
            onError: (failure) =>
              toast.error(toErrorMessage(failure, t("preview.failed"))),
          });
        }}
        onStart={() => {
          if (!input) {
            return;
          }
          create.mutate(
            { ...input, overlap },
            {
              onSuccess: (response) => onStarted(response.import),
              onError: (failure) =>
                toast.error(toErrorMessage(failure, t("preview.failed"))),
            }
          );
        }}
        overlap={overlap}
        preview={result}
        starting={create.isPending}
      />
    </>
  );
}
