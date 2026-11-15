"use client";

import { useState } from "react";

import {
  ArtifactLoadError,
  ArtifactMemberBody,
  ArtifactSkeleton,
} from "@/components/artifacts/artifact-member-body";
import { useArtifact } from "@/lib/hooks/use-artifact";
import type { ArtifactDensity } from "@/types/artifacts";
import { isNotFoundError } from "@/utils/orpc-errors";

/**
 * One artifact for a member, with its version picker state: the loaded
 * artifact, and its body as a skeleton, the document or the load error.
 */
export function useArtifactMemberBody(params: {
  organizationId: string;
  organizationSlug: string;
  artifactId: string;
  density: ArtifactDensity;
  showEyebrow?: boolean;
}) {
  const [version, setVersion] = useState<number | null>(null);
  const query = useArtifact({
    organizationId: params.organizationId,
    artifactId: params.artifactId,
    version,
  });
  const artifact = query.data;

  let body = <ArtifactSkeleton />;
  if (artifact) {
    body = (
      <ArtifactMemberBody
        artifact={artifact}
        density={params.density}
        onShowLatest={() => setVersion(null)}
        organizationId={params.organizationId}
        organizationSlug={params.organizationSlug}
        showEyebrow={params.showEyebrow}
      />
    );
  } else if (query.isError) {
    body = (
      <ArtifactLoadError
        deleted={isNotFoundError(query.error)}
        onRetry={() => query.refetch()}
      />
    );
  }

  return { artifact, body, refetch: query.refetch, setVersion };
}
