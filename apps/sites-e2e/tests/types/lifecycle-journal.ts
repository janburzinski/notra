import type { EmulatorSummary } from "../../emulators/core/types";

export interface LifecyclePhase {
  name: string;
  status: "passed" | "failed";
  durationMs: number;
  builds: number;
}

export interface LifecycleBuild {
  phase: string;
  ok: boolean;
  durationMs: number;
  sandboxId: string | null;
  /** First build error or crash; null for a successful build. */
  error: string | null;
}

export interface LifecycleJournalReport {
  builder: "upstash-box" | "emulated-box";
  passed: boolean;
  failedPhase: string | null;
  /** Set while the suite runs; a killed or timed-out run leaves it behind. */
  runningPhase: string | null;
  error: string | null;
  phases: LifecyclePhase[];
  builds: LifecycleBuild[];
  webhookDeliveries: number;
  /** Routes each emulated provider served; empty `unhandled` everywhere. */
  emulators: EmulatorSummary[];
}
