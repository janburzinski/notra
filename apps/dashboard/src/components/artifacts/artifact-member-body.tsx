"use client";

import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { ArtifactAutopilotBlock } from "@/components/artifacts/artifact-autopilot-block";
import { ArtifactDocument } from "@/components/artifacts/artifact-document";
import { ArtifactEyebrow } from "@/components/artifacts/artifact-eyebrow";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { ArtifactDensity, ArtifactViewData } from "@/types/artifacts";
import { toErrorMessage } from "@/utils/error-message";

export function ArtifactSkeleton() {
  const t = useTranslations("artifacts");
  return (
    <div aria-busy="true" className="space-y-4" role="status">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-28 w-full rounded-2xl" />
    </div>
  );
}

export function ArtifactLoadError({
  deleted,
  onRetry,
}: {
  deleted: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations("artifacts");
  return (
    <div className="space-y-2">
      <p className="text-base font-semibold">
        {deleted ? t("gone") : t("loadFailed")}
      </p>
      {deleted ? null : (
        <button
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
          onClick={onRetry}
          type="button"
        >
          {t("retry")}
        </button>
      )}
    </div>
  );
}

/** A member's view of one version, with live Autopilot items. */
export function ArtifactMemberBody({
  artifact,
  density,
  organizationId,
  organizationSlug,
  onShowLatest,
  showEyebrow = true,
}: {
  artifact: ArtifactViewData;
  density: ArtifactDensity;
  organizationId: string;
  organizationSlug: string;
  onShowLatest: () => void;
  /** The chat panel names the artifact in its tab, so it skips this line. */
  showEyebrow?: boolean;
}) {
  const t = useTranslations("artifacts");
  const queryClient = useQueryClient();
  const isOld = artifact.version !== artifact.currentVersion;
  const restore = useMutation({
    mutationFn: () =>
      dashboardOrpc.artifacts.restore.call({
        organizationId,
        artifactId: artifact.id,
        version: artifact.version,
      }),
    onSuccess: async ({ version }) => {
      toast.success(t("restored", { version }));
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.artifacts.key(),
      });
      onShowLatest();
    },
    onError: (error) => toast.error(toErrorMessage(error, t("restoreFailed"))),
  });

  return (
    <>
      {isOld ? (
        <div className="bg-muted/60 text-muted-foreground mb-6 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm">
          {t("viewingOld", { version: artifact.version })}
          <span className="flex items-center gap-3">
            <button
              className="text-foreground font-medium underline-offset-4 hover:underline disabled:opacity-50"
              disabled={restore.isPending}
              onClick={() => restore.mutate()}
              type="button"
            >
              {t("restore")}
            </button>
            <button
              className="text-foreground font-medium underline-offset-4 hover:underline"
              onClick={onShowLatest}
              type="button"
            >
              {t("showLatest")}
            </button>
          </span>
        </div>
      ) : null}
      <ArtifactDocument
        blocks={artifact.blocks}
        density={density}
        eyebrow={
          showEyebrow ? (
            <ArtifactEyebrow
              date={new Date(artifact.versionCreatedAt)}
              source={artifact.source}
              version={artifact.currentVersion > 1 ? artifact.version : null}
            />
          ) : undefined
        }
        renderAutopilot={(block) => (
          <ArtifactAutopilotBlock
            artifactId={artifact.id}
            autopilot={artifact.autopilot}
            block={block}
            organizationId={organizationId}
            organizationSlug={organizationSlug}
          />
        )}
        summary={artifact.summary}
        title={artifact.title}
      />
    </>
  );
}
