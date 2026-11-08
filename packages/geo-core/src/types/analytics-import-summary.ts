import type {
  AnalyticsImportCapabilities,
  AnalyticsImportProvider,
  AnalyticsImportStatus,
} from "@notra/db/types/analytics-imports";

import type { ImportKind } from "./analytics-imports";

/** One history import's progress; never its connection or credentials. */
export interface AnalyticsImportSummary {
  id: string;
  projectId: string;
  provider: AnalyticsImportProvider;
  kind: ImportKind;
  sourceLabel: string;
  host: string;
  status: AnalyticsImportStatus;
  startDay: string | null;
  endDay: string | null;
  cutoffDay: string | null;
  chunksTotal: number;
  chunksDone: number;
  pageviewsImported: number;
  rowsWritten: number;
  capabilities: AnalyticsImportCapabilities;
  lastError: string | null;
  retryAt: string | null;
  /** Source of the import from the same account that runs first; null unless queued. */
  waitingFor: string | null;
  createdAt: string;
  completedAt: string | null;
}
