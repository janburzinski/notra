import type { IconSvgElement } from "@hugeicons/react";
import type { ReactNode } from "react";

import type { AutopilotFindingView } from "@/types/autopilot";

/** A comment on an Autopilot pull request: a request from Notra or a reply. */
export interface AutopilotRevisionComment {
  id: number;
  /** Who asked, for a request; the GitHub login otherwise. */
  author: string;
  /** Posted by Notra's GitHub App: requests from Notra and the agent's replies. */
  isNotra: boolean;
  /** Asked from Notra; `body` is then what was asked. */
  isRequest: boolean;
  body: string;
  createdAt: string;
  htmlUrl: string;
}

/** The back and forth on a pull request, and whether a request is still running. */
export interface AutopilotRevisionConversation {
  headSha: string;
  comments: AutopilotRevisionComment[];
  /** The last request from Notra has no reply yet. */
  working: boolean;
}

export interface AutopilotRevisionSuggestion {
  label: string;
  icon: IconSvgElement;
}

/** What the workbench shows right now, for the actions beside the post. */
export interface AutopilotPostWorkbenchView {
  /** The commit of the post on screen; null until it has loaded. */
  headSha: string | null;
  working: boolean;
}

export interface AutopilotPostWorkbenchProps {
  finding: AutopilotFindingView;
  organizationId: string;
  /** Who may ask for changes: admins, on an open Autopilot pull request. */
  canRequest: boolean;
  /** Merge, close or hold, beside the item's kind and status. */
  actions?: (view: AutopilotPostWorkbenchView) => ReactNode;
  /** Under the post, above the composer. */
  children?: ReactNode;
}

/** Which blocks of a post one version changed. */
export interface BlockDiff {
  blocks: string[];
  /** Indexes of blocks that are new or rewritten. */
  changed: number[];
  /** What each changed block replaced, by index; null for a new block. */
  before: Record<number, string | null>;
  /**
   * Blocks removed without a replacement, by the index of the block they
   * stood before; `blocks.length` for the end of the post.
   */
  removed: Record<number, string[]>;
}

/** What one commit changed in a post. */
export interface AutopilotPostChange extends BlockDiff {
  /** The title it replaced, when it changed the title. */
  titleBefore: string | null;
  /**
   * The previous version's images. Image keys are assigned per read, so
   * removed blocks resolve their images against the version they came from.
   */
  imagesBefore: Record<string, string>;
}

/** What the latest commit changed, post by post. */
export interface AutopilotPostChanges {
  headSha: string;
  posts: Record<string, AutopilotPostChange>;
}

/** How the latest request ended, for the result card. */
export interface AutopilotRevisionResult {
  /** The commit it pushed; null when it only replied or suggested. */
  commitSha: string | null;
  note: string | null;
  replyUrl: string | null;
}
