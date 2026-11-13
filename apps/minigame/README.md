# Notra Dogfight

The pixel space battle from the `/mcp` hero as a real game, meant for
`play.usenotra.com`. Pick one of six models and fly it: the ship always moves
forward, its nose turns toward the mouse (or a touch stick, a gamepad), Shift
boosts, C brakes for tighter turns and clicking fires forward. Ram small ships,
dodge the rest with the afterburner, survive swarm and aces waves, beat a giant
boss every fifth wave and sign in with X to get on the leaderboard. After every
cleared wave the ship gets one upgrade (`src/constants/upgrades.ts`), drawn from
the run's seed, so it replays on the server like the rest.

TanStack Start, Vite and Nitro like `apps/web`, with no database: runs and the
leaderboard live in Upstash Redis.

## Run it

```sh
bun run --cwd apps/minigame dev        # http://localhost:3006
```

No setup needed: on localhost without X keys you play as `@devpilot` and every
run saves straight to the leaderboard. Without Upstash env vars, development
keeps runs and scores in memory. `http://localhost:3006/auth/dev?handle=you`
switches to another dev player, and `MINIGAME_DEV_PLAYER=off` brings back the
guest flow. None of this works in a production build or off localhost. See
`.env.example` for every variable.

## How scores stay honest

The client never sends a score. `POST /api/runs` hands out a seed, the browser
plays that seed and records one 16-bit input per tick, and on game over it posts
the gzipped inputs to `POST /api/runs/:runId`. The server replays them through
the same simulation (`src/lib/game/sim.ts`) and saves whatever score that
produces. Each run can be submitted once and only within 3 hours.

That only works while the simulation is deterministic in every JS engine:

- Use `dsin`, `dcos`, `datan2` and `dlen` from `src/utils/det-math.ts`, never
  `Math.sin/cos/atan2/hypot` or `**`, inside the simulation.
- All randomness comes from the run's seeded `rng`; effects that don't change
  the outcome (particles, shake, sound) live in the renderer and may use
  `Math.random`.
- Bump `REPLAY_VERSION` in `src/constants/replay.ts` whenever a change would
  replay an old run differently. Runs started on the old version are then
  refused with a "reload" message instead of getting the wrong score.

`bun run test` replays a recorded run for every model and checks it ends with
the same score.

## Cheating

What stops it, in order:

- **Scores are never sent.** The server replays the inputs from the seed it handed out.
- **Runs are played live.** Every 4 s the client sends its tick and a fingerprint of the game state
  (`src/lib/game/state-hash.ts`); the server stamps each with its own clock. On submit
  (`src/lib/game/verify-run.ts`) the replay must hit every fingerprint at its tick, and over no
  stretch may game time outrun the server's clock, which rules out precomputing a run and sending it
  in a burst, and fast-forwarding. Game time may fall behind only in a few gaps (pauses); slow motion
  stretches every gap and is refused. Heartbeats must cover the whole run.
- **One submit per run**, within three hours, by a signed-in X account, rate limited.
- **Bots** playing in real time can't be told apart by these checks, and guessing from input
  patterns would hit real players, so people look at what matters: each player's best run is stored
  and anyone can watch it from the leaderboard, and every new best in the all-time top 10 goes on a
  review list. Moderators (`MINIGAME_ADMIN_IDS`; the local dev players count as moderators) see those
  entries marked ⚑ in the leaderboard, watch them with ▶, then approve (✓) or remove and ban (✕). A
  ban blocks further scores. Rejected runs are logged with their reason as `[minigame] rejected run`,
  moderation as `[minigame] moderated player`.

## X sign-in

OAuth 2.0 with PKCE against the game's own X app (`tweet.read users.read`). The
callback reads `GET /2/users/me` once and revokes the token straight away; the
game keeps no X access. Sessions are HMAC-signed cookies.

## Storage

Upstash Redis, read without the client's automatic deserialisation (it would round 19-digit X ids).
A verified run is saved by one Lua script, so its four boards (all time, this week, each across
models and for the run's model), the run details and the player profile change together. Ties go to
the earlier run. Weekly boards expire 40 days after their last write.

`bun run test` checks the store contract against the in-memory store. To run the same contract
against real Redis, start Redis with the Upstash-compatible REST proxy and point the test at it:

```sh
docker network create mg-srh
docker run -d --rm --name mg-redis --network mg-srh redis:7.4-alpine
docker run -d --rm --name mg-srh -p 8079:80 --network mg-srh -e SRH_MODE=env \
  -e SRH_TOKEN=local_test_token -e SRH_CONNECTION_STRING=redis://mg-redis:6379 \
  hiett/serverless-redis-http
UPSTASH_REDIS_REST_URL=http://localhost:8079 UPSTASH_REDIS_REST_TOKEN=local_test_token \
  MINIGAME_STORE_IT=1 bun --no-env-file test src/lib/server
```

The leaderboard API is cached by the CDN for 15 s (and served up to a minute stale while it refreshes)
and for 5 s inside each server instance, which a new best or a deletion clears. The menu pins the
viewer's own, uncached rank under the board, so a fresh score shows right away.

Players with an X affiliation badge (`user.fields=affiliation`) also play for their company. The
Companies tab ranks companies by the sum of their top five pilots' all-time bests, so a big company
can't win on headcount alone. A pilot's company follows their badge at their next saved run, and
deleting or banning them takes them off it (`SUBMIT_SCRIPT` and `DELETE_PLAYER_SCRIPT` in
`src/constants/server.ts`). Locally, `/auth/dev?handle=ace&company=Acme` signs in with a badge.

Players can share their spot from the game-over screen or their own leaderboard row. The link,
`/s/:playerId?v=<score>`, opens the game, and its preview is a card that
`GET /api/card/:playerId` draws as a PNG on the game's pixel grid
(`src/lib/server/share-card.ts`, no image library). Because the score is in the URL, a new best
gets a fresh preview on X instead of its cached one. Cards stay in the CDN for 5 minutes. The game's
own link, without a player, previews as `/og.png`, a static image designed in Paper (`public/og.png`).


## Deploying

The Vercel project `notra-minigame` (root directory `apps/minigame`, domain `play.usenotra.com`)
deploys from `main` through Vercel's Git integration and skips commits that don't touch the app
(Vercel's "affected projects" setting, like the other apps). It shares no database with the other apps, so it doesn't wait for
`scripts/github/production-deploy.mjs`.
