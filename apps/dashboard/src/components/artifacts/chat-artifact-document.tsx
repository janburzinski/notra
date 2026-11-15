"use client";

import { useTranslations } from "use-intl";

import {
  ArtifactActions,
  ArtifactVersionMenu,
} from "@/components/artifacts/artifact-actions";
import { RIGHT_PANEL_SHELL_CARD_CLASSNAME } from "@/constants/right-panel";
import { useArtifactMemberBody } from "@/lib/hooks/use-artifact-member-body";
import { cn } from "@/lib/utils";
import type { ChatArtifactDocumentProps } from "@/types/artifacts";

/**
 * An artifact as a tab of the chat's preview panel: the same reading area
 * and footer a post gets, with the version, share and delete actions.
 */
export function ChatArtifactDocument({
  organizationId,
  organizationSlug,
  organizationName,
  entry,
  onDeleted,
}: ChatArtifactDocumentProps) {
  const t = useTranslations("artifacts");
  const { artifact, body, setVersion } = useArtifactMemberBody({
    organizationId,
    organizationSlug,
    artifactId: entry.artifactId,
    density: "panel",
    showEyebrow: false,
  });

  return (
    <>
      <div
        aria-label={artifact?.title ?? entry.title}
        className={cn(
          RIGHT_PANEL_SHELL_CARD_CLASSNAME,
          "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 focus-visible:outline-none"
        )}
        role="region"
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The scrollable preview must be reachable for keyboard scrolling.
        tabIndex={0}
      >
        <div className="mx-auto w-full max-w-[42rem]">{body}</div>
      </div>
      <footer className="flex h-12 shrink-0 items-center justify-between gap-2 px-4">
        {artifact && artifact.versions.length > 1 ? (
          <div className="-ml-2.5">
            <ArtifactVersionMenu
              align="start"
              artifact={artifact}
              onPickVersion={setVersion}
            />
          </div>
        ) : (
          <span className="text-muted-foreground truncate text-xs">
            {t("label")}
          </span>
        )}
        {artifact ? (
          <div className="-mr-1.5">
            <ArtifactActions
              artifact={artifact}
              onDeleted={onDeleted}
              organizationId={organizationId}
              organizationName={organizationName}
              organizationSlug={organizationSlug}
              showOpenPage
            />
          </div>
        ) : null}
      </footer>
    </>
  );
}
