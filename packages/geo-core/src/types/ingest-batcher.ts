import type { ingestGeoTrafficEvents } from "@notra/analytics/tinybird/client";
import type { GeoTrafficEventRow } from "@notra/analytics/tinybird/datasources";

import type { BatchedRow } from "./ingest";

type GeoEventWriteResult = Awaited<ReturnType<typeof ingestGeoTrafficEvents>>;

export interface EventBatcherOptions<R extends BatchedRow> {
  intervalMs: number;
  maxBufferedEvents?: number;
  maxRowsPerWrite?: number;
  write?: (rows: R[]) => Promise<GeoEventWriteResult>;
  onWritten?: (rows: R[]) => void;
  now?: () => number;
  liveFlushDelayMs?: number;
  liveRetryDelayMs?: number;
}

export type GeoFlushTrigger = "window" | "live" | "shutdown";

export interface GeoWriteCounts {
  written: number;
  quarantined: number;
  rejected: number;
}

export interface GeoChunkResult<R> extends GeoWriteCounts {
  pending: R[];
  error?: unknown;
}

export interface EventBatcher<R extends BatchedRow> {
  enqueue: (event: R) => boolean;
  expedite: (organizationId: string) => void;
  flush: () => Promise<void>;
  stop: () => Promise<void>;
  size: () => number;
}

export type GeoEventBatcher = EventBatcher<GeoTrafficEventRow>;

export interface UsageBatcherOptions {
  intervalMs: number;
  /** Resolves false when the usage was certainly not recorded. */
  track: (organizationId: string, value: number) => Promise<boolean>;
}

export interface UsageBatcher {
  /** Returns false once stopped; the caller reports the usage itself. */
  add: (organizationId: string, value: number) => boolean;
  stop: () => Promise<void>;
  size: () => number;
}
