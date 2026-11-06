import type { ServerTiming } from "../types/serving";

export function createServerTiming(): ServerTiming {
  const entries: ServerTiming["entries"] = [];
  return {
    entries,
    record(name, durationMs, source) {
      entries.push({ name, durationMs, source });
    },
  };
}

/** `host;desc="cache";dur=0, state;desc="r2";dur=12.4, total;dur=40.1` */
export function serverTimingHeader(timing: ServerTiming, totalMs: number) {
  return [
    ...timing.entries.map(
      ({ name, durationMs, source }) =>
        `${name};desc="${source}";dur=${durationMs.toFixed(1)}`
    ),
    `total;dur=${totalMs.toFixed(1)}`,
  ].join(", ");
}

/** Adds the header, copying responses whose headers are immutable (redirects, cache hits). */
export function withServerTiming(response: Response, value: string): Response {
  const timed = new Response(response.body, response);
  timed.headers.set("Server-Timing", value);
  return timed;
}
