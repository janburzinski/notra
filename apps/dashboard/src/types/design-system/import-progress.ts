import type { ReactNode } from "react";

import type { AnalyticsImportSummary } from "@/types/analytics-imports";

/** One change to the import at `at` ms; `retryInMs` sets `retryAt` that far past that moment. */
export interface ImportProgressSimulatedFrame {
  at: number;
  patch: Partial<AnalyticsImportSummary>;
  retryInMs?: number;
}

export interface ImportProgressScenario {
  id: "api" | "csv" | "failure" | "crawlers" | "vercel-24" | "deleted";
  label: string;
  note: string;
  base: AnalyticsImportSummary;
  frames: ImportProgressSimulatedFrame[];
  duration: number;
}

/** How a simulated import runs: rows written per chunk, newest first, and where it pauses, stops or is deleted. */
export interface ImportProgressRunOptions {
  chunks: number[];
  stepMs: number;
  pauseAfter?: number;
  pauseMs?: number;
  failAfter?: number;
  error?: string;
  /** Deleted after this many chunks: briefly deleting, then gone from the list. */
  deleteAfter?: number;
}

/** The design-system stand-in for the dialog, or the phone sheet, around the progress view. */
export interface ImportProgressDialogPreviewProps {
  item: AnalyticsImportSummary;
  layout: "dialog" | "phone";
  width: number;
  children: ReactNode;
}
