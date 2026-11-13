import type { ReactNode } from "react";

import type { GameStats, ModelId, Rgb } from "@/types/game";
import type {
  CompanyBoardResponse,
  LeaderboardEntry,
  LeaderboardResponse,
  PlayerProfile,
  Standing,
  SubmitResponse,
  ViewerResponse,
} from "@/types/leaderboard";
import type { MenuTab, WatchedRun } from "@/types/session";

export interface ModelSpriteProps {
  model: ModelId;
  scale?: number;
  className?: string;
}

export interface ModelPickerProps {
  value: ModelId;
  onChange: (model: ModelId) => void;
}

export interface LeaderboardProps {
  /** Bump to refetch, e.g. after saving a score. */
  version: number;
  viewerId: string | null;
  /** The company on the viewer's X badge, if any. */
  companyId: string | null;
  /** The viewer's own ranks, read fresh rather than through the cached board. */
  standing: ViewerResponse["standing"];
  onWatch: (entry: LeaderboardEntry) => void;
  /** Opens the viewer's share card; null when they have nothing to share. */
  onShare: (() => void) | null;
  /** Moderators see a button to remove and ban a player. */
  admin: boolean;
  /** The replay watched last, which a moderator's approval vouches for. */
  watched: WatchedRun | null;
}

export interface ModerationButtonsProps {
  player: { id: string; handle: string };
  /** Their best waits on the review list. */
  flagged: boolean;
  /** The replay watched last, which an approval vouches for. */
  watched: WatchedRun | null;
  /** Called after each action with what went wrong, or null. */
  onDone: (error: string | null) => void;
}

export interface RemoteImageProps {
  src: string | null;
  /** Width and height in CSS pixels. */
  size: number;
  className: string;
  /** Classes for the empty square shown without an image. */
  placeholderClassName: string;
}

export interface PrefetchedBoard {
  key: string;
  /** When it was requested, in ms. */
  at: number;
  /** The board once it has arrived. */
  data: LeaderboardResponse | null;
  promise: Promise<LeaderboardResponse>;
}

export interface LoadErrorProps {
  message: string;
  onRetry: () => void;
}

export interface AccountProps {
  viewer: ViewerResponse;
  onDeleted: () => void;
}

export interface SignInButtonProps {
  returnTo?: string;
  children?: ReactNode;
}

export type SubmitState =
  | { status: "idle" }
  | { status: "offline" }
  | { status: "signin" }
  | { status: "saving" }
  | { status: "saved"; result: SubmitResponse }
  | { status: "error"; message: string };

export interface ShareCardDialogProps {
  player: PlayerProfile;
  /** The player's all-time best, which the card shows. */
  best: Standing;
  onClose: () => void;
}

export interface GameOverProps {
  model: ModelId;
  stats: GameStats;
  submit: SubmitState;
  localBest: number;
  player: PlayerProfile | null;
  onRetry: () => void;
  onMenu: () => void;
}

export interface MenuProps {
  model: ModelId;
  onModelChange: (model: ModelId) => void;
  onPlay: () => void;
  starting: boolean;
  viewer: ViewerResponse;
  leaderboardVersion: number;
  onViewerDeleted: () => void;
  onWatch: (entry: LeaderboardEntry) => void;
  /** The tab to open on, e.g. the leaderboard after watching a replay. */
  initialTab: MenuTab;
  watched: WatchedRun | null;
}

export interface PauseMenuProps {
  /** Seconds the run has been paused so far; null when it can't be saved anyway. */
  pausedSeconds: () => number | null;
  onResume: () => void;
  onQuit: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

export interface TouchControlsProps {
  onDash: () => void;
  onBomb: () => void;
  onPause: () => void;
}

export interface CompanyBoardProps {
  /** Bump to refetch, e.g. after saving a score. */
  version: number;
  /** The viewer's company, to highlight its row. */
  companyId: string | null;
}

export type CompanyBoardLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: CompanyBoardResponse };

export type LeaderboardLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: LeaderboardResponse };

export interface GameScreenProps {
  initialViewer: ViewerResponse;
}

export interface SavedMessageProps {
  result: SubmitResponse;
}
