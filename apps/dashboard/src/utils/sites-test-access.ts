import { SITES_TEST_ORGANIZATION_IDS } from "@/constants/sites-testing";
import {
  evaluateLocalDevAuth,
  hostnameFromHostHeader,
  requestLooksPubliclyExposed,
} from "@/utils/local-dev-auth";

export function isSitesTestRequestAllowed(
  request: Pick<Request, "headers">
): boolean {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.SITES_TEST_ENABLED !== "true"
  ) {
    return false;
  }

  const hostname = hostnameFromHostHeader(request.headers.get("host"));
  if (
    !hostname ||
    !["127.0.0.1", "localhost", "::1"].includes(hostname) ||
    requestLooksPubliclyExposed(request.headers) ||
    request.headers.has("forwarded") ||
    request.headers.has("x-forwarded-host")
  ) {
    return false;
  }

  try {
    const database = new URL(process.env.DATABASE_URL ?? "");
    return (
      ["postgres:", "postgresql:"].includes(database.protocol) &&
      database.hostname === "127.0.0.1" &&
      Boolean(database.port) &&
      database.pathname === "/notra_server_audit" &&
      database.search === ""
    );
  } catch {
    return false;
  }
}

export function isSitesFixtureFlagRequestAllowed(
  request: Pick<Request, "headers">,
  organizationId: string
): boolean {
  return (
    process.env.SITES_TEST_FIXTURE_FLAGS_ENABLED === "true" &&
    SITES_TEST_ORGANIZATION_IDS.has(organizationId) &&
    isSitesTestRequestAllowed(request) &&
    evaluateLocalDevAuth(request.headers).kind === "allowed"
  );
}
