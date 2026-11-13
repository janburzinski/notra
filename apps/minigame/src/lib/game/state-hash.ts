import type { Game } from "@/lib/game/sim";

const FNV_OFFSET = 0x81_1c_9d_c5;
const FNV_PRIME = 0x01_00_01_93;

/**
 * A fingerprint of where a run stands, sent with every heartbeat. The server replays the run and
 * checks it reached the same fingerprint at the same tick, which proves the client really was there at
 * the time the heartbeat arrived. Integer maths only, so every engine agrees.
 */
export function stateHash(game: Game) {
  const p = game.player;
  const values = [
    game.ticks,
    game.score,
    game.kills,
    game.wave.number,
    p.hp,
    Math.round(p.x * 16),
    Math.round(p.y * 16),
    game.enemies.length,
    game.bullets.length,
  ];
  let hash = FNV_OFFSET;
  for (const value of values) {
    // fold each value in 8 bits at a time; values are small non-negative integers
    let v = Math.abs(Math.trunc(value));
    for (let i = 0; i < 4; i += 1) {
      hash ^= v & 0xff;
      hash = Math.imul(hash, FNV_PRIME) >>> 0;
      v = Math.floor(v / 256);
    }
  }
  return hash >>> 0;
}
