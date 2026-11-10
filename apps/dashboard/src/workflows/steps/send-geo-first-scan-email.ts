import "@/workflows/runtime";
import type { GeoCheckScanScope } from "@notra/db/types/geo-checks";

import { sendGeoFirstScanEmail } from "@/lib/email/geo-first-scan";

export async function sendGeoFirstScanEmailStep(scope: GeoCheckScanScope) {
  "use step";
  const result = await sendGeoFirstScanEmail(scope);
  // Throwing lets the step retry; the Brew idempotency key skips recipients already sent.
  if (result !== "quiet" && result.failed) {
    throw new Error("First GEO results email could not be sent");
  }
}
