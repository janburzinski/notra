export const SESSION_COOKIE = "mg_session";
export const OAUTH_COOKIE = "mg_oauth";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30;
export const OAUTH_MAX_AGE_S = 60 * 10;

/** How long a started run can still be submitted, including a sign-in after it ended. */
export const RUN_TTL_S = 60 * 60 * 3;
/** How long a ban keeps a player off the boards: the 2 years the privacy policy gives for ban records. */
export const BAN_TTL_S = 60 * 60 * 24 * 730;

export const X_AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
export const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
export const X_REVOKE_URL = "https://api.x.com/2/oauth2/revoke";
export const X_ME_URL =
  "https://api.x.com/2/users/me?user.fields=profile_image_url,affiliation";
/** users/me needs both. We never post or read anything else. */
export const X_SCOPES = "tweet.read users.read";

export const LEADERBOARD_SIZE = 50;
/** Seconds a server instance reuses a board it just read. */
export const LEADERBOARD_MEMO_S = 5;
/** The CDN serves a board for 15 s and up to a minute stale while it refetches in the background. */
/** Replays only change when a player sets a new best, so they can sit in the CDN for a while. */
export const REPLAY_CACHE_CONTROL =
  "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
export const LEADERBOARD_CACHE_CONTROL =
  "public, max-age=0, s-maxage=15, stale-while-revalidate=60";
/** Weekly boards are kept a little longer than the weeks they cover, then expire. */
export const WEEK_BOARD_TTL_S = 60 * 60 * 24 * 40;
/** Weeks back a deletion sweeps, matching WEEK_BOARD_TTL_S. */
export const WEEKS_KEPT = 6;

export const RUN_LIMIT = { max: 40, windowS: 600 } as const;
export const SUBMIT_LIMIT = { max: 60, windowS: 3600 } as const;

/** Compressed replays are small; anything bigger is not a real run. */
export const MAX_REPLAY_BYTES = 512 * 1024;
export const MAX_REPLAY_INFLATED_BYTES = 2 * 1024 * 1024;

export const KEY_PREFIX = "mg";

/**
 * Re-adds a company's score from its members' set: the sum of its top pilots' all-time bests, or no
 * entry at all once it has no members. Shared by the scripts below; takes key names so each script
 * passes its own KEYS.
 */
const RECOUNT_COMPANY = `
local function recount(members, cid, board, info, pilots)
  local top = redis.call('ZREVRANGE', members, 0, pilots - 1, 'WITHSCORES')
  if #top == 0 then
    redis.call('ZREM', board, cid)
    redis.call('HDEL', info, cid)
    return
  end
  local total = 0
  for i = 2, #top, 2 do total = total + math.floor(tonumber(top[i])) end
  redis.call('ZADD', board, total, cid)
end
`;

/**
 * Saves a verified run in one atomic step. KEYS: four boards, their four meta hashes, the player key,
 * the ban key, the replay key, then for companies: the player's company pointer, the old and new
 * company's members, the company board and the company details hash. ARGV: player id, score, ranking
 * score, run JSON, player JSON, weekly TTL, one "1"/"0" per board for whether it is weekly, the replay
 * JSON, then the company the caller saw before (or ""), the player's company now (or ""), its JSON and
 * how many pilots count. A board only changes when the new score beats the stored one (ranking scores
 * carry a tie-break fraction, hence the floor). The player's company always follows their badge, so a
 * pilot who changed company moves with their best. Returns 1 when the all-time best rose, 0 when it
 * didn't, -1 for a banned player and -2, having changed nothing, when the player's company changed
 * since the caller read it; the caller reads it again and retries, so no stale membership is left.
 */
export const SUBMIT_SCRIPT = `${RECOUNT_COMPANY}
local id = ARGV[1]
local score = tonumber(ARGV[2])
if redis.call('EXISTS', KEYS[10]) == 1 then return -1 end
local old = redis.call('GET', KEYS[12]) or ''
if old ~= ARGV[12] then return -2 end
redis.call('SET', KEYS[9], ARGV[5])
local improved = 0
for i = 1, 4 do
  local current = redis.call('ZSCORE', KEYS[i], id)
  if (not current) or math.floor(tonumber(current)) < score then
    redis.call('ZADD', KEYS[i], ARGV[3], id)
    redis.call('HSET', KEYS[i + 4], id, ARGV[4])
    if i == 1 then improved = 1 end
  end
  if ARGV[6 + i] == '1' then
    redis.call('EXPIRE', KEYS[i], ARGV[6])
    redis.call('EXPIRE', KEYS[i + 4], ARGV[6])
  end
end
if improved == 1 then redis.call('SET', KEYS[11], ARGV[11]) end
local pilots = tonumber(ARGV[15])
local new = ARGV[13]
if old ~= '' and old ~= new then
  redis.call('ZREM', KEYS[13], id)
  recount(KEYS[13], old, KEYS[15], KEYS[16], pilots)
end
if new ~= '' then
  redis.call('ZADD', KEYS[14], redis.call('ZSCORE', KEYS[1], id), id)
  redis.call('SET', KEYS[12], new)
  redis.call('HSET', KEYS[16], new, ARGV[14])
  recount(KEYS[14], new, KEYS[15], KEYS[16], pilots)
else
  redis.call('DEL', KEYS[12])
end
return improved
`;

/**
 * Deletes a player in one step: takes them off their company and off every
 * board, with their review entry, profile, replay and submit limit, so an upload that lands meanwhile
 * can't leave a company counting a deleted player. KEYS: their company pointer, the company's
 * members, the company board, the company details hash, then each board followed by its meta hash,
 * then the review hash, profile, replay and limit. ARGV: player id, the company the caller read (''
 * for none), pilots that count, number of boards. Returns 0, changing nothing, when the company
 * pointer changed since it was read, so the caller reads it again.
 */
export const DELETE_PLAYER_SCRIPT = `${RECOUNT_COMPANY}
local company = redis.call('GET', KEYS[1]) or ''
if company ~= ARGV[2] then return 0 end
if company ~= '' then
  redis.call('ZREM', KEYS[2], ARGV[1])
  redis.call('DEL', KEYS[1])
  recount(KEYS[2], company, KEYS[3], KEYS[4], tonumber(ARGV[3]))
end
local boards = tonumber(ARGV[4])
for i = 0, boards - 1 do
  redis.call('ZREM', KEYS[5 + i * 2], ARGV[1])
  redis.call('HDEL', KEYS[6 + i * 2], ARGV[1])
end
local rest = 5 + boards * 2
redis.call('HDEL', KEYS[rest], ARGV[1])
redis.call('DEL', KEYS[rest + 1], KEYS[rest + 2], KEYS[rest + 3])
return 1
`;

/**
 * Appends a heartbeat to a live run. KEYS: the run, its heartbeat list; ARGV: the beat JSON, the most
 * heartbeats allowed. Refused once the run is gone or full; the list expires with the run.
 */
export const BEAT_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
if redis.call('LLEN', KEYS[2]) >= tonumber(ARGV[2]) then return 0 end
redis.call('RPUSH', KEYS[2], ARGV[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl > 0 then redis.call('PEXPIRE', KEYS[2], ttl) end
return 1
`;

/** Takes a run and its heartbeats in one step, so a run can be submitted at most once. */
export const TAKE_RUN_SCRIPT = `
local run = redis.call('GET', KEYS[1])
if not run then return false end
local beats = redis.call('LRANGE', KEYS[2], 0, -1)
redis.call('DEL', KEYS[1], KEYS[2])
return {run, beats}
`;

/** Rate limit counter: counts and sets the window's expiry atomically. KEYS: the counter; ARGV: seconds. */
export const ALLOW_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count
`;

/** Who you are when playing locally without signing in; see devPlayerEnabled. */
export const DEV_PLAYER = {
  id: "dev-devpilot",
  handle: "devpilot",
  name: "Dev pilot",
  avatar: null,
  company: null,
} as const;
