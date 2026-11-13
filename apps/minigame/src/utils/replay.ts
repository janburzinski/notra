import { MAX_RUN_TICKS } from "@/constants/game";
import { REPLAY_VERSION } from "@/constants/replay";
import type { TickInput } from "@/types/game";

/** Packs one tick of input into 14 bits: steering target, throttle and the buttons. */
export function encodeInput(input: TickInput) {
  return (
    (input.steer & 0xff) |
    ((input.throttle + 1) << 8) |
    (input.steering ? 1 << 10 : 0) |
    (input.fire ? 1 << 11 : 0) |
    (input.dash ? 1 << 12 : 0) |
    (input.bomb ? 1 << 13 : 0)
  );
}

export function decodeInput(value: number): TickInput {
  const throttle = ((value >> 8) & 0b11) - 1;
  return {
    steer: value & 0xff,
    throttle: throttle > 0 ? 1 : (throttle as -1 | 0),
    steering: (value & (1 << 10)) !== 0,
    fire: (value & (1 << 11)) !== 0,
    dash: (value & (1 << 12)) !== 0,
    bomb: (value & (1 << 13)) !== 0,
  };
}

function writeVarint(out: number[], value: number) {
  let v = value;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  out.push(v);
}

/** Collects one encoded input per tick and stores them as runs of repeated values. */
export class ReplayRecorder {
  private readonly runs: number[] = [];
  private current = -1;
  private count = 0;
  ticks = 0;

  push(value: number) {
    this.ticks += 1;
    if (value === this.current) {
      this.count += 1;
      return;
    }
    if (this.count > 0) {
      this.runs.push(this.current, this.count);
    }
    this.current = value;
    this.count = 1;
  }

  toBytes() {
    const out: number[] = [REPLAY_VERSION];
    for (let i = 0; i < this.runs.length; i += 2) {
      writeVarint(out, this.runs[i] ?? 0);
      writeVarint(out, this.runs[i + 1] ?? 0);
    }
    if (this.count > 0) {
      writeVarint(out, this.current);
      writeVarint(out, this.count);
    }
    return Uint8Array.from(out);
  }
}

/** Reads a replay back into one encoded input per tick, or null when it's malformed or too long. */
export function readReplay(bytes: Uint8Array): Uint16Array | null {
  if (bytes[0] !== REPLAY_VERSION) {
    return null;
  }
  const values: number[] = [];
  let offset = 1;
  const varint = () => {
    let result = 0;
    let scale = 1;
    for (let i = 0; i < 5; i += 1) {
      const byte = bytes[offset];
      if (byte === undefined) {
        return null;
      }
      offset += 1;
      result += (byte & 0x7f) * scale;
      if (byte < 0x80) {
        return result;
      }
      scale *= 128;
    }
    return null;
  };
  let total = 0;
  while (offset < bytes.length) {
    const value = varint();
    const count = varint();
    if (value === null || count === null || value > 0xff_ff || count < 1) {
      return null;
    }
    total += count;
    if (total > MAX_RUN_TICKS) {
      return null;
    }
    values.push(value, count);
  }
  const ticks = new Uint16Array(total);
  let index = 0;
  for (let i = 0; i < values.length; i += 2) {
    ticks.fill(values[i] ?? 0, index, index + (values[i + 1] ?? 0));
    index += values[i + 1] ?? 0;
  }
  return ticks;
}
