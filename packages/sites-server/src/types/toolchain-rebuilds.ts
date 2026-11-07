export interface ToolchainRebuildOptions {
  /** Only consider these sites; every site when unset. */
  siteIds?: readonly string[];
}

export interface QueuedToolchainRebuild {
  siteId: string;
  deploymentId: string;
  jobId: string;
}

export interface ToolchainRebuildSweep {
  /** Null when the release set no render fingerprint, which turns this off. */
  renderFingerprint: string | null;
  queued: QueuedToolchainRebuild[];
}
