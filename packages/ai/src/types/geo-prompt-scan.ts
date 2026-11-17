export interface GeoPromptScanStarterInput {
  organizationId: string;
  projectId?: string;
  prompt: string;
  engines?: string[];
}

/**
 * started: the scan is running. choose: the prompt text matched several
 * tracked prompts. not_found: it matched none. error: the scan couldn't start,
 * with the reason to pass on.
 */
export type GeoPromptScanOutcome =
  | { status: "started"; scanId: string; promptId: string; prompt: string }
  | {
      status: "choose" | "not_found";
      prompts: { id: string; prompt: string }[];
    }
  | { status: "error"; error: string };

/**
 * Starts one tracked prompt's scan. Supplied by the host app, since starting a
 * scan needs geo-core's workflow and billing services.
 */
export type GeoPromptScanStarter = (
  input: GeoPromptScanStarterInput
) => Promise<GeoPromptScanOutcome>;

export interface GeoPromptFinderInput {
  organizationId: string;
  projectId?: string;
  query?: string;
}

/** Enabled tracked prompts matching a query, with the total that matched. */
export type GeoPromptFindOutcome =
  | { prompts: { id: string; prompt: string }[]; total: number }
  | { status: "error"; error: string };

/** Finds tracked prompts. Supplied by the host app like the scan starter. */
export type GeoPromptFinder = (
  input: GeoPromptFinderInput
) => Promise<GeoPromptFindOutcome>;
