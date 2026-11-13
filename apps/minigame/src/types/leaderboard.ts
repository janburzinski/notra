import type { z } from "zod";

import type {
  sessionPayloadSchema,
  storedRunSchema,
  xUserSchema,
} from "@/schemas/api";
import type { ModelId } from "@/types/game";

/** The organisation behind an X affiliation badge, keyed by the organisation's X user id. */
export interface Company {
  id: string;
  name: string;
  badge: string | null;
  url: string | null;
}

/** An X account, as shown on the leaderboard. */
export interface PlayerProfile {
  id: string;
  handle: string;
  name: string;
  avatar: string | null;
  /** The company on the player's X affiliation badge, if they have one. */
  company: Company | null;
}

/** The affiliation badge as X describes it. */
export type XAffiliation = NonNullable<
  z.infer<typeof xUserSchema>["data"]["affiliation"]
>;

export type SessionPayload = z.infer<typeof sessionPayloadSchema>;

export type StoredRun = z.infer<typeof storedRunSchema>;

export type BoardPeriod = "all" | "week";

export type ModelFilter = ModelId | "all";

/** The run behind a player's best score on one board. */
export interface ScoreMeta {
  score: number;
  wave: number;
  kills: number;
  model: ModelId;
  at: number;
}

export interface LeaderboardEntry extends ScoreMeta {
  rank: number;
  player: PlayerProfile;
}

export interface LeaderboardResponse {
  period: BoardPeriod;
  model: ModelFilter;
  entries: LeaderboardEntry[];
}

export interface Standing extends ScoreMeta {
  rank: number;
}

/** A company's spot on the company board: the all-time bests of its top pilots, added up. */
export interface CompanyEntry {
  rank: number;
  company: Company;
  score: number;
  /** How many of its pilots have a score. */
  players: number;
  /** Its best pilot. */
  top: PlayerProfile | null;
}

export interface CompanyBoardResponse {
  entries: CompanyEntry[];
}

/** A player's spot on the board, as a share card shows it. */
export interface ShareCard {
  player: PlayerProfile;
  all: Standing;
  week: Standing | null;
}

/** What a share link's preview says about the player. */
export interface SharePreview {
  playerId: string;
  handle: string;
  rank: number;
  score: number;
  /** The model's display name. */
  model: string;
}

export interface ViewerResponse {
  player: PlayerProfile | null;
  standing: { all: Standing | null; week: Standing | null };
  /** Whether the viewer may remove and ban players. */
  admin: boolean;
}

export interface SubmitResponse {
  score: number;
  wave: number;
  kills: number;
  bosses: number;
  model: ModelId;
  /** Whether this run beat the player's all-time best. */
  improved: boolean;
  standing: { all: Standing | null; week: Standing | null };
}

export interface CreateRunResponse {
  runId: string;
  seed: number;
}
