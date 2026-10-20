import { readRequestConsent } from "@c15t/core/server";
import {
  C15T_ANALYTICS_CATEGORY,
  C15T_OPT_IN_MODEL,
} from "@notra/sites-core/constants/integrations";
import { c15tInitPolicySchema } from "@notra/sites-core/schemas/consent-policy";

import {
  CONSENT_POLICY_CACHE_TTL_MS,
  TRAFFIC_REPORT_TIMEOUT_MS,
} from "../constants/traffic";
import type { VisitorConsentCheck } from "../types/traffic";

const policyModels = new Map<string, { model: string; expiresAt: number }>();

async function policyModel(check: VisitorConsentCheck): Promise<string> {
  const { country, region } = check;
  const key = `${check.backendURL}|${country}|${region}`;
  const cached = policyModels.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.model;
  }
  const headers = new Headers();
  if (country) {
    headers.set("x-c15t-country", country);
  }
  if (region) {
    headers.set("x-c15t-region", region);
  }
  const response = await check.fetch(
    `${check.backendURL.replace(/\/+$/, "")}/init`,
    { headers, signal: AbortSignal.timeout(TRAFFIC_REPORT_TIMEOUT_MS) }
  );
  const parsed = c15tInitPolicySchema.parse(await response.json());
  policyModels.set(key, {
    model: parsed.policy.model,
    expiresAt: Date.now() + CONSENT_POLICY_CACHE_TTL_MS,
  });
  return parsed.policy.model;
}

export async function countsHumanVisitor(
  check: VisitorConsentCheck
): Promise<boolean> {
  const { state } = readRequestConsent({
    adapter: "@notra/sites",
    request: { headers: check.headers },
  });
  const choice =
    state.initialRecords?.choice?.categories[C15T_ANALYTICS_CATEGORY]?.value;
  if (choice !== undefined) {
    return choice;
  }
  return await policyModel(check).then(
    (model) => model !== C15T_OPT_IN_MODEL,
    () => false
  );
}
