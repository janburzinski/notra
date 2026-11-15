"use client";

import { Notra } from "@notra/ui/components/ui/svgs/notra";
import { useTranslations } from "use-intl";

import { SharedArtifactAutopilotBlock } from "@/components/artifacts/artifact-autopilot-block";
import { ArtifactDocument } from "@/components/artifacts/artifact-document";
import { ArtifactEyebrow } from "@/components/artifacts/artifact-eyebrow";
import type { SharedArtifactViewData } from "@/types/artifacts";

/** A publicly shared artifact: read-only, always its latest version. */
export function SharedArtifactPage({
  artifact,
}: {
  artifact: SharedArtifactViewData;
}) {
  const t = useTranslations("artifacts");
  return (
    <main className="bg-background min-h-svh">
      <div className="mx-auto w-full max-w-3xl px-4 pt-10 pb-24 sm:pt-14">
        <ArtifactDocument
          blocks={artifact.blocks}
          density="page"
          eyebrow={
            <ArtifactEyebrow
              date={new Date(artifact.updatedAt)}
              source={artifact.source}
            />
          }
          renderAutopilot={(block) => (
            <SharedArtifactAutopilotBlock
              block={block}
              findings={artifact.findings}
            />
          )}
          summary={artifact.summary}
          title={artifact.title}
        />
        <footer className="text-muted-foreground mt-16 flex items-center gap-2 border-t pt-6 text-xs">
          <a
            className="hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
            href="https://usenotra.com"
            rel="noreferrer"
            target="_blank"
          >
            <Notra className="size-3.5" />
            {t("madeWith")}
          </a>
        </footer>
      </div>
    </main>
  );
}
