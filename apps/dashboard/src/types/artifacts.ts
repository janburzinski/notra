import type {
  ArtifactAutopilotBlock,
  ArtifactBlock,
} from "@notra/ai/types/artifact";
import type { ReactNode } from "react";

import type {
  loadArtifactView,
  loadSharedArtifactView,
} from "@/lib/artifacts/view";

export type ArtifactViewData = NonNullable<
  Awaited<ReturnType<typeof loadArtifactView>>
>;
export type SharedArtifactViewData = NonNullable<
  Awaited<ReturnType<typeof loadSharedArtifactView>>
>;
type ArtifactAutopilotData = NonNullable<ArtifactViewData["autopilot"]>;
type SharedArtifactFinding = SharedArtifactViewData["findings"][number];

/** `page` is the full-width page; `panel` the narrower chat side panel. */
export type ArtifactDensity = "page" | "panel";

/** How a change in a table cell reads: good news, bad news, or none. */
export type ArtifactTableCellTrend = "up" | "down" | "flat";

export interface ArtifactDocumentProps {
  title: string;
  summary: string | null;
  blocks: ArtifactBlock[];
  density: ArtifactDensity;
  /** Line above the title: kind, version, date. */
  eyebrow?: ReactNode;
  renderAutopilot: (block: ArtifactAutopilotBlock) => ReactNode;
}

export interface ArtifactAutopilotBlockProps {
  /** Its own queries are the ones a button refreshes. */
  artifactId: string;
  block: ArtifactAutopilotBlock;
  organizationId: string;
  organizationSlug: string;
  autopilot: ArtifactAutopilotData | null;
}

export interface SharedArtifactAutopilotBlockProps {
  block: ArtifactAutopilotBlock;
  findings: SharedArtifactFinding[];
}

export interface ArtifactPageProps {
  artifactId: string;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
}

export interface ChatArtifactCardProps {
  organizationId: string;
  artifactId: string;
  title: string;
  /** From the tool's output; undefined for replies saved before it had one. */
  summary?: string | null;
  version: number;
  onOpen: () => void;
}

export interface ArtifactActionsProps {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  artifact: ArtifactViewData;
  onDeleted?: () => void;
  /** The panel offers "Open page"; the page itself doesn't. */
  showOpenPage?: boolean;
}

/** An artifact a chat reply saved, shown as a tab in the chat's preview panel. */
export interface ChatArtifactEntry {
  /** Tab id, `artifact:` + the artifact id, so every artifact gets one tab. */
  tabId: string;
  artifactId: string;
  title: string;
}

export interface ChatArtifactDocumentProps {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  entry: ChatArtifactEntry;
  onDeleted: () => void;
}
