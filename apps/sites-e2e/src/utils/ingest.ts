import type { IngestRequest } from "../types/harness";

/** A notra.js beacon the Worker relayed, not its own report of a request. */
export function isBeacon(event: IngestRequest) {
  return event.body.type === "beacon";
}

/** What notra.js sent, without the key, page URL and referrer. */
export function beaconFields(event: IngestRequest): Record<string, unknown> {
  return isBeacon(event) ? (event.body.beacon as Record<string, unknown>) : {};
}

/** The request ingest sees: the Worker's report, or a beacon's page view. */
export function reportedRequest(event: IngestRequest): Record<string, unknown> {
  return isBeacon(event)
    ? (event.body.request as Record<string, unknown>)
    : event.body;
}

export function isEngagement(event: IngestRequest) {
  return isBeacon(event) && beaconFields(event).t !== undefined;
}

export function isPageViewBeacon(event: IngestRequest) {
  const fields = beaconFields(event);
  return (
    isBeacon(event) &&
    fields.t === undefined &&
    fields.o === undefined &&
    fields.x === undefined
  );
}

export function countByUrl(events: IngestRequest[]) {
  const counts: Record<string, number> = {};
  for (const event of events) {
    const url = String(reportedRequest(event).url);
    counts[url] = (counts[url] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))
  );
}
