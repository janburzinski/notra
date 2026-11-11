export interface AnalyticsImportWorkflowPayload {
  importId: string;
  /**
   * The import's recovery attempts when the run started. A run whose
   * generation recovery has moved past stops at its next chunk. Absent on
   * delete runs and on runs started before generations existed; the chunk
   * step fences those by their workflow run id.
   */
  generation?: number;
}
