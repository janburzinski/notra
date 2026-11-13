# Minigame

Read `README.md` first. The one rule that is easy to break: `src/lib/game/sim.ts`
and everything it imports run on the server to verify scores, so they must stay
deterministic. No `Math.sin/cos/atan2/hypot`, `**`, `Math.random`, `Date` or DOM
in the simulation, and bump `REPLAY_VERSION` when a change would replay old runs
differently. Run `bun run test`, `bun run check-types` and `bun run build` from
this directory.
