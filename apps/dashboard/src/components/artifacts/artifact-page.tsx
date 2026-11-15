"use client";

import { Notra } from "@notra/ui/components/ui/svgs/notra";

import {
  ArtifactActions,
  ArtifactVersionMenu,
} from "@/components/artifacts/artifact-actions";
import Link from "@/components/framework/link";
import { useArtifactMemberBody } from "@/lib/hooks/use-artifact-member-body";
import type { ArtifactPageProps } from "@/types/artifacts";

/**
 * An artifact on its own page, for links from Slack or a new tab. Only
 * members of its workspace get here: its Autopilot items can be merged.
 */
export function ArtifactPage({
  artifactId,
  organizationId,
  organizationSlug,
  organizationName,
}: ArtifactPageProps) {
  const { artifact, body, refetch, setVersion } = useArtifactMemberBody({
    organizationId,
    organizationSlug,
    artifactId,
    density: "page",
  });

  return (
    <main className="bg-background min-h-svh">
      <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-24 sm:pt-8">
        <nav
          aria-label={organizationName}
          className="mb-8 flex items-center justify-between gap-3 text-sm sm:mb-10"
        >
          <Link
            className="flex min-w-0 items-center gap-2 font-medium"
            href={`/${organizationSlug}`}
          >
            <span className="dark:bg-foreground flex size-5 shrink-0 items-center justify-center rounded-sm">
              <Notra className="size-4.5 dark:size-4" />
            </span>
            <span className="truncate">{organizationName}</span>
          </Link>
          {artifact ? (
            <div className="flex shrink-0 items-center gap-1">
              <ArtifactVersionMenu
                artifact={artifact}
                onPickVersion={setVersion}
              />
              <ArtifactActions
                artifact={artifact}
                onDeleted={() => refetch()}
                organizationId={organizationId}
                organizationName={organizationName}
                organizationSlug={organizationSlug}
              />
            </div>
          ) : null}
        </nav>
        {body}
      </div>
    </main>
  );
}
