"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ArtifactBlockTitle } from "@/components/artifacts/artifact-document";
import {
  AutopilotBriefFindingCard,
  AutopilotBriefFindingList,
} from "@/components/autopilot/autopilot-brief-finding-card";
import { AutopilotFindingConfirmDialog } from "@/components/autopilot/autopilot-finding-confirm-dialog";
import { ARTIFACT_SHARED_FINDING_STAGES } from "@/constants/artifacts";
import { AUTOPILOT_KIND_META } from "@/constants/autopilot-ui";
import { useAutopilotActions } from "@/lib/hooks/use-autopilot";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  ArtifactAutopilotBlockProps,
  SharedArtifactAutopilotBlockProps,
} from "@/types/artifacts";
import type { AutopilotPendingFindingAction } from "@/types/autopilot";
import { findingsInBlockOrder } from "@/utils/artifact-findings";

/**
 * Autopilot items as on the daily brief: live status and the buttons to
 * merge, write or close, for whoever may make that call.
 */
export function ArtifactAutopilotBlock({
  artifactId,
  block,
  organizationId,
  organizationSlug,
  autopilot,
}: ArtifactAutopilotBlockProps) {
  const queryClient = useQueryClient();
  const { merge, writeSuggestion } = useAutopilotActions(organizationId);
  const [pending, setPending] = useState<AutopilotPendingFindingAction | null>(
    null
  );
  if (!autopilot) {
    return null;
  }
  const findings = findingsInBlockOrder(block.findingIds, autopilot.findings);
  if (findings.length === 0) {
    return null;
  }
  // Every version of this artifact, and no other artifact.
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: dashboardOrpc.artifacts.get.key({
        input: { organizationId, artifactId },
      }),
    });

  return (
    <section>
      {block.title ? (
        <ArtifactBlockTitle>{block.title}</ArtifactBlockTitle>
      ) : null}
      <AutopilotBriefFindingList>
        {findings.map((finding) => (
          <AutopilotBriefFindingCard
            canManage={autopilot.canManage}
            canWrite={autopilot.canWrite}
            finding={finding}
            key={finding.id}
            merging={
              merge.isPending && merge.variables?.findingId === finding.id
            }
            onDismiss={() => setPending({ kind: "dismiss", finding })}
            onMerge={(method) =>
              merge.mutate(
                { findingId: finding.id, method },
                { onSettled: refresh }
              )
            }
            onWrite={() =>
              writeSuggestion.mutate(finding.id, { onSettled: refresh })
            }
            organizationSlug={organizationSlug}
            timeZone={autopilot.timeZone}
            writing={
              writeSuggestion.isPending &&
              writeSuggestion.variables === finding.id
            }
          />
        ))}
      </AutopilotBriefFindingList>
      <AutopilotFindingConfirmDialog
        branch={autopilot.branch}
        onClose={() => {
          setPending(null);
          refresh();
        }}
        organizationId={organizationId}
        pending={pending}
      />
    </section>
  );
}

/** On a public copy: what each item is and where it stands, nothing to press. */
export function SharedArtifactAutopilotBlock({
  block,
  findings,
}: SharedArtifactAutopilotBlockProps) {
  const rows = findingsInBlockOrder(block.findingIds, findings);
  if (rows.length === 0) {
    return null;
  }
  return (
    <section>
      {block.title ? (
        <ArtifactBlockTitle>{block.title}</ArtifactBlockTitle>
      ) : null}
      <AutopilotBriefFindingList>
        {rows.map((finding) => {
          const meta = AUTOPILOT_KIND_META[finding.kind];
          return (
            <div className="space-y-1 px-4 py-3.5" key={finding.id}>
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={meta.icon}
                  size={14}
                  strokeWidth={1.5}
                />
                {meta.label}
                <span aria-hidden="true">·</span>
                {ARTIFACT_SHARED_FINDING_STAGES[finding.status]}
              </p>
              <p className="text-sm font-medium text-pretty">{finding.title}</p>
            </div>
          );
        })}
      </AutopilotBriefFindingList>
    </section>
  );
}
