import type { SmartDeploymentEvaluation } from "@notra/sites-core/types/smart-deployments";

import type { SiteDeployment } from "./deployments";

export interface SmartDeploymentComparison {
  fingerprint: string | null;
  snapshotId: string | null;
  year: number;
  baseline: {
    deploymentId: string;
    generation: number;
    /** `production` for a preview that has no published preview of its own. */
    kind: SiteDeployment["kind"];
    /** The candidate's fingerprint computed for the baseline's build target. */
    fingerprint: string;
  } | null;
  evaluation: SmartDeploymentEvaluation | null;
}
