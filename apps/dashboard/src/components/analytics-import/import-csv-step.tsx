"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { GeoExternalLinkButton } from "@/components/geo/geo-external-link-button";
import { GeoSetupStep } from "@/components/geo/geo-setup-step";
import {
  ANALYTICS_IMPORT_MIN_HOST_LENGTH,
  ANALYTICS_IMPORT_PROVIDER_URLS,
} from "@/constants/analytics-imports";
import { useAnalyticsImportMutations } from "@/lib/hooks/use-analytics-imports";
import type {
  AnalyticsImportOverlapMode,
  AnalyticsImportPreview,
} from "@/types/analytics-imports";
import type {
  ImportCsvStepProps,
  ImportZipFieldError,
} from "@/types/components/analytics-import";
import { importFileErrorMessage } from "@/utils/analytics-imports";
import { toErrorMessage } from "@/utils/error-message";

import { ImportHostField } from "./import-host-field";
import { ImportPreview, ImportPreviewFooter } from "./import-preview";
import { ImportProviderLogo } from "./import-provider-mark";
import { ImportZipField } from "./import-zip-field";

export function ImportCsvStep({
  organizationId,
  projectId,
  defaultHost,
  onStarted,
}: ImportCsvStepProps) {
  const t = useTranslations("geo.analyticsImport");
  const [file, setFile] = useState<File | null>(null);
  const [host, setHost] = useState(defaultHost);
  // Reuses the uploaded ZIP between preview and import; never rendered.
  const uploadKey = useRef<string | undefined>(undefined);
  const [result, setResult] = useState<AnalyticsImportPreview | null>(null);
  const [overlap, setOverlap] = useState<AnalyticsImportOverlapMode>("skip");
  const [starting, setStarting] = useState(false);
  const [fileError, setFileError] = useState<ImportZipFieldError | null>(null);
  const { csv } = useAnalyticsImportMutations(organizationId);

  const run = (previewOnly: boolean) => {
    if (!file) {
      return;
    }
    setStarting(!previewOnly);
    setFileError(null);
    csv.mutate(
      {
        projectId,
        host: host.trim(),
        file,
        previewOnly,
        overlap,
        ...(uploadKey.current ? { uploadKey: uploadKey.current } : {}),
      },
      {
        onSuccess: (response) => {
          uploadKey.current = response.uploadKey;
          if (previewOnly) {
            setResult(response.preview);
            setOverlap("skip");
            return;
          }
          if (response.import) {
            onStarted(response.import);
          }
        },
        onError: (error) => {
          // The server deletes an upload that no import took over.
          uploadKey.current = undefined;
          const fileProblem = importFileErrorMessage(error);
          if (fileProblem) {
            setFileError((previous) => ({
              text: fileProblem,
              count: (previous?.count ?? 0) + 1,
            }));
            return;
          }
          toast.error(
            toErrorMessage(
              error,
              previewOnly ? t("csv.failed") : t("preview.failed")
            )
          );
        },
      }
    );
  };

  return (
    <>
      <div className="flex min-w-0 flex-col gap-5">
        <ol aria-label={t("guide", { provider: "Plausible" })}>
          <GeoSetupStep
            plain
            description={t("csv.openDescription")}
            index={1}
            title={t("csv.openTitle")}
          >
            <div className="flex">
              <GeoExternalLinkButton
                href={ANALYTICS_IMPORT_PROVIDER_URLS.plausible_csv}
                icon={
                  <ImportProviderLogo
                    className="h-3 w-auto"
                    provider="plausible_csv"
                  />
                }
                label={t("openProvider", { provider: "Plausible" })}
              />
            </div>
          </GeoSetupStep>
          <GeoSetupStep
            plain
            description={t("csv.exportDescription")}
            index={2}
            title={t("csv.exportTitle")}
          />
          <GeoSetupStep plain index={3} title={t("csv.uploadTitle")}>
            <ImportZipField
              disabled={csv.isPending}
              file={file}
              hideLabel
              onChange={(next) => {
                setFile(next);
                uploadKey.current = undefined;
                setResult(null);
                setFileError(null);
              }}
              serverError={fileError}
            />
          </GeoSetupStep>
          <GeoSetupStep
            plain
            description={t("source.hostHint")}
            index={4}
            title={t("csv.domainTitle")}
          >
            <ImportHostField
              bare
              onChange={(value) => {
                setHost(value);
                setResult(null);
              }}
              value={host}
            />
          </GeoSetupStep>
        </ol>
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
          Boolean(file) &&
          host.trim().length >= ANALYTICS_IMPORT_MIN_HOST_LENGTH
        }
        checkLabel={t("csv.preview")}
        checking={csv.isPending && !starting}
        onCheck={() => run(true)}
        onStart={() => run(false)}
        overlap={overlap}
        preview={result}
        starting={csv.isPending && starting}
      />
    </>
  );
}
