import { Redis } from "@upstash/redis";
import type { z } from "zod";

import { MAX_BEATS } from "@/constants/anti-cheat";
import { COMPANY_TOP_PILOTS } from "@/constants/leaderboard";
import { MODEL_IDS } from "@/constants/models";
import {
  BAN_TTL_S,
  ALLOW_SCRIPT,
  BEAT_SCRIPT,
  KEY_PREFIX,
  DELETE_PLAYER_SCRIPT,
  LEADERBOARD_SIZE,
  SUBMIT_SCRIPT,
  TAKE_RUN_SCRIPT,
  WEEK_BOARD_TTL_S,
  WEEKS_KEPT,
} from "@/constants/server";
import { isProduction } from "@/lib/server/config";
import {
  beatSchema,
  companySchema,
  playerProfileSchema,
  reviewItemSchema,
  storedReplaySchema,
  scoreMetaSchema,
  storedRunSchema,
} from "@/schemas/api";
import type {
  Beat,
  ReviewItem,
  StoredReplay,
  SubmitOutcome,
  TakenRun,
} from "@/types/anti-cheat";
import type {
  BoardPeriod,
  Company,
  CompanyEntry,
  LeaderboardEntry,
  ModelFilter,
  PlayerProfile,
  ScoreMeta,
  Standing,
  StoredRun,
} from "@/types/leaderboard";
import { isoWeekKey } from "@/utils/week";

/** Every board a run counts toward: all time and this week, across models and for its own model. */
const SUBMIT_BOARDS: readonly (readonly [BoardPeriod, "all" | "own"])[] = [
  ["all", "all"],
  ["all", "own"],
  ["week", "all"],
  ["week", "own"],
];

function parseJson<T>(raw: unknown, schema: z.ZodType<T>): T | null {
  if (typeof raw !== "string") {
    return null;
  }
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * A leaderboard sorts by this: the score, plus a fraction that is larger for earlier runs, so ties go to
 * whoever got there first. The fraction stays below 1, so `floor` gives the score back.
 */
function rankingScore(meta: ScoreMeta) {
  return meta.score + (1 - meta.at / 1e13);
}

function fallbackPlayer(id: string): PlayerProfile {
  return { id, handle: "unknown", name: "", avatar: null, company: null };
}

export interface GameStore {
  createRun(id: string, run: StoredRun, ttlS: number): Promise<void>;
  /** Records a heartbeat for a live run; false when the run is gone or has too many. */
  addBeat(id: string, beat: Beat): Promise<boolean>;
  /** Reads and deletes a run with its heartbeats, so each one is submitted at most once. */
  takeRun(id: string): Promise<TakenRun | null>;
  getReplay(playerId: string): Promise<StoredReplay | null>;
  /** Blocks a player from posting scores again. */
  ban(playerId: string): Promise<void>;
  isBanned(playerId: string): Promise<boolean>;
  /** Puts a player's new best on the moderators' review list, or takes it off. */
  flagForReview(playerId: string, item: ReviewItem): Promise<void>;
  clearReview(playerId: string): Promise<void>;
  reviewQueue(): Promise<Record<string, ReviewItem>>;
  /**
   * Records a verified run in one step: refused for banned players, and a new all-time best stores
   * its replay with it, so a best and its replay never drift apart.
   */
  submit(
    player: PlayerProfile,
    meta: ScoreMeta,
    replay: StoredReplay
  ): Promise<SubmitOutcome>;
  top(period: BoardPeriod, model: ModelFilter): Promise<LeaderboardEntry[]>;
  standing(period: BoardPeriod, playerId: string): Promise<Standing | null>;
  /** Companies by the all-time bests of their top pilots, best first. */
  companies(): Promise<CompanyEntry[]>;
  /** The X profile saved with a player's scores, or null when they have none. */
  profile(playerId: string): Promise<PlayerProfile | null>;
  deletePlayer(playerId: string): Promise<void>;
  /** Counts a hit against a limit; false once over it. */
  allow(bucket: string, max: number, windowS: number): Promise<boolean>;
}

/** SUBMIT_SCRIPT's answer when the player's company changed since it was read. */
const STALE_COMPANY = -2;
/** Reads of the company pointer before giving up; two sessions racing settle in one retry. */
const COMPANY_RETRIES = 5;

function submitOutcome(code: number): SubmitOutcome {
  if (code === -1) {
    return "banned";
  }
  return code === 1 ? "improved" : "kept";
}

/** Key names, under a prefix so tests can run against a real database without touching live data. */
class Keys {
  private readonly prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  key(...parts: string[]) {
    return [this.prefix, ...parts].join(":");
  }

  /** The sorted set behind one board: all time or one week, all models or one. */
  board(
    period: BoardPeriod,
    model: ModelFilter,
    week = isoWeekKey(new Date())
  ) {
    const base = period === "week" ? `lb:week:${week}` : "lb:all";
    return this.key(model === "all" ? base : `${base}:${model}`);
  }

  /** The best run behind each player's score on a board, as JSON by player id. */
  meta(board: string) {
    return `${board}:meta`;
  }

  player(id: string) {
    return this.key("player", id);
  }

  run(id: string) {
    return this.key("run", id);
  }

  beats(runId: string) {
    return this.key("run", runId, "beats");
  }

  replay(playerId: string) {
    return this.key("replay", playerId);
  }

  banned(playerId: string) {
    return this.key("banned", playerId);
  }

  review() {
    return this.key("review");
  }

  /** Companies by score. */
  companyBoard() {
    return this.key("co", "board");
  }

  /** Each company's details as JSON, by company id. */
  companyInfo() {
    return this.key("co", "info");
  }

  /** A company's pilots by their all-time ranking score. */
  companyMembers(companyId: string) {
    return this.key("co", "members", companyId);
  }

  /** Which company a player counts for. */
  companyOf(playerId: string) {
    return this.key("co", "of", playerId);
  }

  limit(bucket: string) {
    return this.key("rl", bucket);
  }
}

/**
 * Upstash Redis. Values are stored as JSON strings and read back as strings: the client's automatic
 * deserialisation is off, because it turns 19-digit X user ids and all-digit handles into lossy numbers.
 */
export class RedisStore implements GameStore {
  private readonly redis: Redis;
  private readonly keys: Keys;

  constructor(redis: Redis, prefix = KEY_PREFIX) {
    this.redis = redis;
    this.keys = new Keys(prefix);
  }

  async createRun(id: string, run: StoredRun, ttlS: number) {
    await this.redis.set(this.keys.run(id), JSON.stringify(run), { ex: ttlS });
  }

  async addBeat(id: string, beat: Beat) {
    const added = await this.redis.eval<string[], number>(
      BEAT_SCRIPT,
      [this.keys.run(id), this.keys.beats(id)],
      [JSON.stringify(beat), String(MAX_BEATS)]
    );
    return Number(added) === 1;
  }

  async takeRun(id: string) {
    const taken = await this.redis.eval<string[], [string, string[]] | null>(
      TAKE_RUN_SCRIPT,
      [this.keys.run(id), this.keys.beats(id)],
      []
    );
    if (!Array.isArray(taken)) {
      return null;
    }
    const run = parseJson(taken[0], storedRunSchema);
    if (!run) {
      return null;
    }
    const beats = (taken[1] ?? [])
      .map((raw) => parseJson(raw, beatSchema))
      .filter((beat): beat is Beat => beat !== null);
    return { run, beats };
  }

  async getReplay(playerId: string) {
    return parseJson(
      await this.redis.get(this.keys.replay(playerId)),
      storedReplaySchema
    );
  }

  async ban(playerId: string) {
    await this.redis.set(this.keys.banned(playerId), "1", { ex: BAN_TTL_S });
  }

  async isBanned(playerId: string) {
    return Number(await this.redis.exists(this.keys.banned(playerId))) === 1;
  }

  async flagForReview(playerId: string, item: ReviewItem) {
    await this.redis.hset(this.keys.review(), {
      [playerId]: JSON.stringify(item),
    });
  }

  async clearReview(playerId: string) {
    await this.redis.hdel(this.keys.review(), playerId);
  }

  async reviewQueue() {
    // without automatic deserialisation, HGETALL answers with a flat [field, value, …] list
    const raw = (await this.redis.hgetall(this.keys.review())) as unknown;
    const pairs: [string, unknown][] = [];
    if (Array.isArray(raw)) {
      for (let i = 0; i + 1 < raw.length; i += 2) {
        pairs.push([String(raw[i]), raw[i + 1]]);
      }
    } else if (raw && typeof raw === "object") {
      pairs.push(...Object.entries(raw));
    }
    const queue: Record<string, ReviewItem> = {};
    for (const [id, value] of pairs) {
      const item = parseJson(value, reviewItemSchema);
      if (item) {
        queue[id] = item;
      }
    }
    return queue;
  }

  /** One script, so the ban check, boards, run details, profile and replay change together. */
  async submit(
    player: PlayerProfile,
    meta: ScoreMeta,
    replay: StoredReplay
  ): Promise<SubmitOutcome> {
    const boards = SUBMIT_BOARDS.map(([period, model]) =>
      this.keys.board(period, model === "all" ? "all" : meta.model)
    );
    // the script refuses with STALE_COMPANY when the player's company changed after this read, which
    // only a second session submitting at the same moment can cause; reading again settles it
    for (let attempt = 0; attempt < COMPANY_RETRIES; attempt += 1) {
      const code = await this.submitOnce(player, meta, replay, boards);
      if (code !== STALE_COMPANY) {
        return submitOutcome(code);
      }
    }
    throw new Error("Company membership kept changing during a submit");
  }

  private async submitOnce(
    player: PlayerProfile,
    meta: ScoreMeta,
    replay: StoredReplay,
    boards: string[]
  ) {
    const before =
      (await this.redis.get<string>(this.keys.companyOf(player.id))) ?? "";
    const now = player.company?.id ?? "";
    const code = await this.redis.eval<string[], number>(
      SUBMIT_SCRIPT,
      [
        ...boards,
        ...boards.map((board) => this.keys.meta(board)),
        this.keys.player(player.id),
        this.keys.banned(player.id),
        this.keys.replay(player.id),
        this.keys.companyOf(player.id),
        this.keys.companyMembers(before || now || "none"),
        this.keys.companyMembers(now || "none"),
        this.keys.companyBoard(),
        this.keys.companyInfo(),
      ],
      [
        player.id,
        String(meta.score),
        String(rankingScore(meta)),
        JSON.stringify(meta),
        JSON.stringify(player),
        String(WEEK_BOARD_TTL_S),
        ...SUBMIT_BOARDS.map(([period]) => (period === "week" ? "1" : "0")),
        JSON.stringify(replay),
        String(before),
        now,
        player.company ? JSON.stringify(player.company) : "",
        String(COMPANY_TOP_PILOTS),
      ]
    );
    return Number(code);
  }

  async top(period: BoardPeriod, model: ModelFilter) {
    const board = this.keys.board(period, model);
    const ids = await this.redis.zrange<string[]>(
      board,
      0,
      LEADERBOARD_SIZE - 1,
      { rev: true }
    );
    if (ids.length === 0) {
      return [];
    }
    const pipeline = this.redis.pipeline();
    pipeline.hmget(this.keys.meta(board), ...ids);
    pipeline.mget(...ids.map((id) => this.keys.player(id)));
    // without automatic deserialisation, HMGET answers with an array in field order
    const [metas, players] = await pipeline.exec<[unknown[], unknown[]]>();
    const entries: LeaderboardEntry[] = [];
    ids.forEach((id, index) => {
      const meta = parseJson(metas[index], scoreMetaSchema);
      if (meta) {
        entries.push({
          ...meta,
          rank: entries.length + 1,
          player:
            parseJson(players[index], playerProfileSchema) ??
            fallbackPlayer(id),
        });
      }
    });
    return entries;
  }

  async standing(period: BoardPeriod, playerId: string) {
    const board = this.keys.board(period, "all");
    const [rank, meta] = await Promise.all([
      this.redis.zrevrank(board, playerId),
      this.redis.hget(this.keys.meta(board), playerId),
    ]);
    const parsed = parseJson(meta, scoreMetaSchema);
    return rank === null || !parsed ? null : { ...parsed, rank: rank + 1 };
  }

  async profile(playerId: string) {
    return parseJson(
      await this.redis.get(this.keys.player(playerId)),
      playerProfileSchema
    );
  }

  async companies() {
    // without automatic deserialisation, WITHSCORES answers with a flat [member, score, …] list
    const ranked = await this.redis.zrange<string[]>(
      this.keys.companyBoard(),
      0,
      LEADERBOARD_SIZE - 1,
      { rev: true, withScores: true }
    );
    const ids: string[] = [];
    const scores: number[] = [];
    for (let i = 0; i + 1 < ranked.length; i += 2) {
      ids.push(String(ranked[i]));
      scores.push(Number(ranked[i + 1]));
    }
    if (ids.length === 0) {
      return [];
    }
    const pipeline = this.redis.pipeline();
    pipeline.hmget(this.keys.companyInfo(), ...ids);
    for (const id of ids) {
      pipeline.zcard(this.keys.companyMembers(id));
      pipeline.zrange(this.keys.companyMembers(id), 0, 0, { rev: true });
    }
    const [infos, ...counts] = await pipeline.exec<unknown[]>();
    const topIds = ids.map((_, index) => {
      const top = counts[index * 2 + 1];
      return Array.isArray(top) && top[0] !== undefined ? String(top[0]) : null;
    });
    const wanted = topIds.filter((id): id is string => id !== null);
    const profiles =
      wanted.length > 0
        ? await this.redis.mget<unknown[]>(
            ...wanted.map((id) => this.keys.player(id))
          )
        : [];
    const byId = new Map<string, PlayerProfile>();
    wanted.forEach((id, index) => {
      const profile = parseJson(profiles[index], playerProfileSchema);
      if (profile) {
        byId.set(id, profile);
      }
    });
    const entries: CompanyEntry[] = [];
    ids.forEach((id, index) => {
      const company = parseJson((infos as unknown[])[index], companySchema);
      const topId = topIds[index];
      if (company) {
        entries.push({
          rank: entries.length + 1,
          company,
          score: scores[index] ?? 0,
          players: Number(counts[index * 2] ?? 0),
          top: topId ? (byId.get(topId) ?? null) : null,
        });
      }
    });
    return entries;
  }

  async deletePlayer(playerId: string) {
    const now = Date.now();
    const boardKeys: string[] = [];
    for (const model of ["all", ...MODEL_IDS] as ModelFilter[]) {
      const boards = [this.keys.board("all", model)];
      for (let week = 0; week < WEEKS_KEPT; week += 1) {
        boards.push(
          this.keys.board(
            "week",
            model,
            isoWeekKey(new Date(now - week * 7 * 86_400_000))
          )
        );
      }
      for (const board of boards) {
        boardKeys.push(board, this.keys.meta(board));
      }
    }
    for (let attempt = 0; attempt < COMPANY_RETRIES; attempt += 1) {
      const company =
        (await this.redis.get<string>(this.keys.companyOf(playerId))) ?? "";
      const done = await this.redis.eval<string[], number>(
        DELETE_PLAYER_SCRIPT,
        [
          this.keys.companyOf(playerId),
          this.keys.companyMembers(company),
          this.keys.companyBoard(),
          this.keys.companyInfo(),
          ...boardKeys,
          this.keys.review(),
          this.keys.player(playerId),
          this.keys.replay(playerId),
          this.keys.limit(`submit:${playerId}`),
        ],
        [
          playerId,
          company,
          String(COMPANY_TOP_PILOTS),
          String(boardKeys.length / 2),
        ]
      );
      if (Number(done) === 1) {
        return;
      }
    }
    throw new Error("Company membership kept changing during a delete");
  }

  /** Counts and sets the window's expiry in one script, so a key can never be left without one. */
  async allow(bucket: string, max: number, windowS: number) {
    const count = await this.redis.eval<string[], number>(
      ALLOW_SCRIPT,
      [this.keys.limit(bucket)],
      [String(windowS)]
    );
    return Number(count) <= max;
  }
}

/** Keeps everything in memory for local development without Upstash. Lost on restart. */
export class MemoryStore implements GameStore {
  private readonly runs = new Map<
    string,
    { run: StoredRun; beats: Beat[]; expires: number }
  >();
  private readonly replays = new Map<string, StoredReplay>();
  /** Ban expiry times by player id. */
  private readonly bans = new Map<string, number>();
  private readonly review = new Map<string, ReviewItem>();
  private readonly players = new Map<string, PlayerProfile>();
  /** The company each player counts for, as of their last saved run. */
  private readonly companyOf = new Map<string, string>();
  private readonly companyInfo = new Map<string, Company>();
  private readonly boards = new Map<string, Map<string, ScoreMeta>>();
  private readonly hits = new Map<string, { count: number; expires: number }>();
  private readonly keys = new Keys("memory");

  async createRun(id: string, run: StoredRun, ttlS: number) {
    this.runs.set(id, { run, beats: [], expires: Date.now() + ttlS * 1000 });
  }

  async addBeat(id: string, beat: Beat) {
    const entry = this.runs.get(id);
    if (
      !entry ||
      entry.expires <= Date.now() ||
      entry.beats.length >= MAX_BEATS
    ) {
      return false;
    }
    entry.beats.push(beat);
    return true;
  }

  async takeRun(id: string) {
    const entry = this.runs.get(id);
    this.runs.delete(id);
    return entry && entry.expires > Date.now()
      ? { run: entry.run, beats: entry.beats }
      : null;
  }

  async getReplay(playerId: string) {
    return this.replays.get(playerId) ?? null;
  }

  async ban(playerId: string) {
    this.bans.set(playerId, Date.now() + BAN_TTL_S * 1000);
  }

  async isBanned(playerId: string) {
    return (this.bans.get(playerId) ?? 0) > Date.now();
  }

  async flagForReview(playerId: string, item: ReviewItem) {
    this.review.set(playerId, item);
  }

  async clearReview(playerId: string) {
    this.review.delete(playerId);
  }

  async reviewQueue() {
    return Object.fromEntries(this.review);
  }

  async submit(
    player: PlayerProfile,
    meta: ScoreMeta,
    replay: StoredReplay
  ): Promise<SubmitOutcome> {
    if (await this.isBanned(player.id)) {
      return "banned";
    }
    this.players.set(player.id, player);
    if (player.company) {
      this.companyOf.set(player.id, player.company.id);
      this.companyInfo.set(player.company.id, player.company);
    } else {
      this.companyOf.delete(player.id);
    }
    let improved = false;
    SUBMIT_BOARDS.forEach(([period, model], index) => {
      const name = this.keys.board(
        period,
        model === "all" ? "all" : meta.model
      );
      const board = this.boards.get(name) ?? new Map<string, ScoreMeta>();
      const best = board.get(player.id);
      if (!best || meta.score > best.score) {
        board.set(player.id, meta);
        improved ||= index === 0;
      }
      this.boards.set(name, board);
    });
    if (improved) {
      this.replays.set(player.id, replay);
    }
    return improved ? "improved" : "kept";
  }

  private sorted(name: string) {
    return [...(this.boards.get(name)?.entries() ?? [])].sort(
      (a, b) => rankingScore(b[1]) - rankingScore(a[1])
    );
  }

  async top(period: BoardPeriod, model: ModelFilter) {
    return this.sorted(this.keys.board(period, model))
      .slice(0, LEADERBOARD_SIZE)
      .map(([id, meta], index) => ({
        ...meta,
        rank: index + 1,
        player: this.players.get(id) ?? fallbackPlayer(id),
      }));
  }

  async standing(period: BoardPeriod, playerId: string) {
    const rows = this.sorted(this.keys.board(period, "all"));
    const index = rows.findIndex(([id]) => id === playerId);
    const row = rows[index];
    return row ? { ...row[1], rank: index + 1 } : null;
  }

  async profile(playerId: string) {
    return this.players.get(playerId) ?? null;
  }

  async companies() {
    const members = new Map<string, [string, ScoreMeta][]>();
    for (const row of this.sorted(this.keys.board("all", "all"))) {
      const company = this.companyOf.get(row[0]);
      if (company) {
        members.set(company, [...(members.get(company) ?? []), row]);
      }
    }
    return [...members]
      .map(([id, rows]) => ({
        id,
        rows,
        score: rows
          .slice(0, COMPANY_TOP_PILOTS)
          .reduce((sum, [, meta]) => sum + meta.score, 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, LEADERBOARD_SIZE)
      .flatMap(({ id, rows, score }) => {
        const company = this.companyInfo.get(id);
        const topId = rows[0]?.[0];
        return company
          ? [
              {
                company,
                score,
                players: rows.length,
                top: topId ? (this.players.get(topId) ?? null) : null,
              },
            ]
          : [];
      })
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  async deletePlayer(playerId: string) {
    for (const board of this.boards.values()) {
      board.delete(playerId);
    }
    this.players.delete(playerId);
    this.companyOf.delete(playerId);
    this.replays.delete(playerId);
    this.review.delete(playerId);
  }

  async allow(bucket: string, max: number, windowS: number) {
    const now = Date.now();
    const entry = this.hits.get(bucket);
    if (!entry || entry.expires < now) {
      this.hits.set(bucket, { count: 1, expires: now + windowS * 1000 });
      return true;
    }
    entry.count += 1;
    return entry.count <= max;
  }
}

let store: GameStore | null = null;

/** Upstash when configured, memory in development, and null in production without Upstash. */
export function getStore(): GameStore | null {
  if (store) {
    return store;
  }
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token && process.env.MINIGAME_MEMORY_STORE !== "true") {
    store = new RedisStore(
      new Redis({ url, token, automaticDeserialization: false })
    );
  } else if (!isProduction()) {
    store = new MemoryStore();
  }
  return store;
}
