import { afterAll, describe, expect, test } from "bun:test";

import { Redis } from "@upstash/redis";

import { REPLAY_VERSION } from "@/constants/replay";
import { type GameStore, MemoryStore, RedisStore } from "@/lib/server/store";
import type { PlayerProfile, ScoreMeta } from "@/types/leaderboard";

// X ids are 19 digits, past what a JS number holds exactly; handles can be all digits too.
const ace: PlayerProfile = {
  id: "1790123456789012345",
  handle: "1337",
  name: "Ace",
  avatar: "https://pbs.twimg.com/profile_images/1/a_normal.png",
  company: null,
};
const rival: PlayerProfile = {
  id: "1790123456789012346",
  handle: "rival",
  name: "Rival",
  avatar: null,
  company: null,
};

const acme = {
  id: "1790000000000000001",
  name: "Acme",
  badge: "https://pbs.twimg.com/profile_images/2/acme_bigger.png",
  url: "https://x.com/acme",
};
const globex = { ...acme, id: "1790000000000000002", name: "Globex" };

function pilot(index: number, company: PlayerProfile["company"]) {
  return {
    id: `17955555555555555${String(index).padStart(2, "0")}`,
    handle: `pilot${index}`,
    name: `Pilot ${index}`,
    avatar: null,
    company,
  };
}

function run(
  score: number,
  at: number,
  model: ScoreMeta["model"] = "claude"
): ScoreMeta {
  return { score, wave: 7, kills: 40, model, at };
}

const replay = {
  seed: 1,
  model: "grok" as const,
  version: REPLAY_VERSION,
  score: 7000,
  replay: "H4sI",
};

function contract(name: string, make: () => GameStore) {
  describe(name, () => {
    const store = make();

    test("keeps each player's best and exact ids", async () => {
      expect(
        await store.submit(ace, run(5000, 1_800_000_000_000), replay)
      ).toBe("improved");
      expect(
        await store.submit(ace, run(3000, 1_800_000_001_000), replay)
      ).toBe("kept");
      const top = await store.top("all", "all");
      expect(top).toHaveLength(1);
      expect(top[0]?.player).toEqual(ace);
      expect(top[0]?.score).toBe(5000);
      expect(
        await store.submit(ace, run(7000, 1_800_000_002_000), replay)
      ).toBe("improved");
      expect((await store.top("all", "all"))[0]?.score).toBe(7000);
    });

    test("breaks ties in favour of the earlier run", async () => {
      await store.submit(rival, run(7000, 1_800_000_009_000, "grok"), replay);
      const top = await store.top("all", "all");
      expect(top.map((entry) => entry.player.id)).toEqual([ace.id, rival.id]);
      expect((await store.standing("all", rival.id))?.rank).toBe(2);
    });

    test("fills the model and weekly boards", async () => {
      expect((await store.top("all", "claude"))[0]?.player.id).toBe(ace.id);
      expect((await store.top("all", "grok"))[0]?.player.id).toBe(rival.id);
      expect(await store.top("all", "gemini")).toEqual([]);
      expect((await store.top("week", "all")).length).toBe(2);
      expect((await store.standing("week", ace.id))?.score).toBe(7000);
    });

    test("deleting a player removes them everywhere", async () => {
      await store.deletePlayer(ace.id);
      expect(
        (await store.top("all", "all")).map((entry) => entry.player.id)
      ).toEqual([rival.id]);
      expect(await store.top("all", "claude")).toEqual([]);
      expect(await store.standing("all", ace.id)).toBeNull();
      expect((await store.standing("all", rival.id))?.rank).toBe(1);
    });

    test("runs can be taken once", async () => {
      const stored = {
        seed: 42,
        model: "claude" as const,
        version: REPLAY_VERSION,
        createdAt: 1,
      };
      await store.createRun("run-1", stored, 60);
      expect(await store.addBeat("run-1", { at: 5, tick: 240, hash: 7 })).toBe(
        true
      );
      expect(await store.addBeat("run-1", { at: 9, tick: 480, hash: 8 })).toBe(
        true
      );
      expect(await store.takeRun("run-1")).toEqual({
        run: stored,
        beats: [
          { at: 5, tick: 240, hash: 7 },
          { at: 9, tick: 480, hash: 8 },
        ],
      });
      expect(await store.takeRun("run-1")).toBeNull();
      // a heartbeat for a run that is gone or never existed is refused
      expect(await store.addBeat("run-1", { at: 10, tick: 500, hash: 1 })).toBe(
        false
      );
    });

    test("keeps the best run's replay and bans", async () => {
      expect(await store.getReplay(rival.id)).toEqual(replay);
      // a lower run neither replaces the best nor its replay
      const lower = { ...replay, score: 100, seed: 2 };
      await store.submit(rival, run(100, 1_800_000_010_000, "grok"), lower);
      expect(await store.getReplay(rival.id)).toEqual(replay);
      expect(await store.isBanned(rival.id)).toBe(false);
      await store.ban(rival.id);
      expect(await store.isBanned(rival.id)).toBe(true);
      await store.deletePlayer(rival.id);
      expect(await store.getReplay(rival.id)).toBeNull();
      expect(await store.isBanned(rival.id)).toBe(true);
      // a run that was verified while the ban landed changes nothing
      expect(
        await store.submit(rival, run(9000, 1_800_000_011_000, "grok"), replay)
      ).toBe("banned");
      expect(await store.getReplay(rival.id)).toBeNull();
      expect(await store.standing("all", rival.id)).toBeNull();
    });

    test("keeps the review list", async () => {
      const item = { score: 900, rank: 3, at: 1 };
      // a player of its own, so earlier tests' bests don't get in the way
      const flagged = pilot(30, null);
      await store.submit(flagged, run(900, 1_800_000_020_000), {
        ...replay,
        seed: 11,
      });
      await store.flagForReview(flagged.id, item);
      await store.flagForReview(rival.id, { ...item, rank: 4 });
      expect(await store.reviewQueue()).toEqual({
        [flagged.id]: item,
        [rival.id]: { ...item, rank: 4 },
      });
      // a newer best replaced the run the moderator watched: approving the old one leaves it flagged
      await store.submit(flagged, run(950, 1_800_000_021_000), {
        ...replay,
        seed: 12,
      });
      expect(await store.clearReview(flagged.id, 11)).toBe(false);
      expect(await store.reviewQueue()).toHaveProperty(flagged.id);
      expect(await store.clearReview(flagged.id, 12)).toBe(true);
      await store.deletePlayer(rival.id);
      expect(await store.reviewQueue()).toEqual({});
    });

    test("ranks companies by their top pilots and follows badge changes", async () => {
      const at = 1_800_000_100_000;
      // six Acme pilots, but only the best five count: 6000 + 5000 + 4000 + 3000 + 2000
      for (let i = 1; i <= 6; i += 1) {
        await store.submit(pilot(i, acme), run(i * 1000, at + i), replay);
      }
      await store.submit(pilot(10, globex), run(15_000, at), replay);
      let board = await store.companies();
      expect(board.map((entry) => [entry.company.name, entry.score])).toEqual([
        ["Acme", 20_000],
        ["Globex", 15_000],
      ]);
      expect(board[0]?.players).toBe(6);
      expect(board[0]?.top?.handle).toBe("pilot6");
      expect(board[0]?.company).toEqual(acme);

      // Acme's best pilot joins Globex; a run below their best still moves them, best and all
      expect(
        await store.submit(pilot(6, globex), run(10, at + 50), replay)
      ).toBe("kept");
      board = await store.companies();
      expect(board.map((entry) => [entry.company.name, entry.score])).toEqual([
        ["Globex", 21_000],
        ["Acme", 15_000],
      ]);
      expect(board[1]?.players).toBe(5);

      // losing the badge takes a pilot off the company board
      await store.submit(pilot(10, null), run(10, at + 60), replay);
      board = await store.companies();
      expect(board.map((entry) => [entry.company.name, entry.score])).toEqual([
        ["Acme", 15_000],
        ["Globex", 6000],
      ]);

      // a deletion counts too, and a company without pilots drops off
      await store.deletePlayer(pilot(6, null).id);
      expect(
        (await store.companies()).map((entry) => entry.company.name)
      ).toEqual(["Acme"]);
    });

    test("rate limits count up to the limit, and deleting a player doesn't reset them", async () => {
      const bucket = `submit:${ace.id}`;
      expect(await store.allow(bucket, 2, 60)).toBe(true);
      expect(await store.allow(bucket, 2, 60)).toBe(true);
      await store.deletePlayer(ace.id);
      expect(await store.allow(bucket, 2, 60)).toBe(false);
    });
  });
}

contract("memory store", () => new MemoryStore());

// Against a real Upstash database only when asked to, under a throwaway prefix that is wiped after.
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
if (process.env.MINIGAME_STORE_IT === "1" && url && token) {
  const redis = new Redis({ url, token, automaticDeserialization: false });
  const prefix = `mg-test-${crypto.randomUUID()}`;
  contract("redis store", () => new RedisStore(redis, prefix));

  test("a submit that raced a company change moves the pilot only once", async () => {
    const racer = pilot(40, acme);
    // a second session switches the pilot to Globex between the next submit's read and its script
    let stale = false;
    const racing = new Proxy(redis, {
      get(target, property, receiver) {
        if (property !== "get") {
          return Reflect.get(target, property, receiver);
        }
        return async (key: string) => {
          if (stale && key.endsWith(`co:of:${racer.id}`)) {
            stale = false;
            await store.submit(pilot(40, globex), run(10, at + 100), replay);
            return acme.id;
          }
          return target.get(key);
        };
      },
    });
    const store = new RedisStore(racing, `${prefix}:race`);
    const at = 1_800_000_200_000;
    await store.submit(racer, run(4000, at), replay);
    stale = true;
    await store.submit(pilot(40, null), run(10, at + 200), replay);
    expect(stale).toBe(false);
    expect(await store.companies()).toEqual([]);
    // no leftover Globex membership: a new Globex pilot counts alone
    await store.submit(pilot(41, globex), run(1000, at + 300), replay);
    const board = await store.companies();
    expect(board.map((entry) => [entry.score, entry.players])).toEqual([
      [1000, 1],
    ]);
  });
  afterAll(async () => {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, {
        match: `${prefix}:*`,
        count: 200,
      });
      cursor = String(next);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  });
}
