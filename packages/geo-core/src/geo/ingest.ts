import { createHmac, timingSafeEqual } from "node:crypto";

import { db } from "@notra/db/drizzle";
import { organizations, projects } from "@notra/db/schema";
import {
  TRACKER_PLUS_RELEASE,
  TRACKER_RELEASE,
} from "@notra/web-tracker/release";
import type { TrackerReleaseLink } from "@notra/web-tracker/types/release";
import { and, eq, sql } from "drizzle-orm";
import { Effect } from "effect";

import {
  GEO_DRAIN_PATHS,
  GEO_INGEST_PATH,
  GEO_INGEST_SECRET_ENV,
  GEO_INGEST_SITE_TOKEN_PREFIX,
  GEO_INGEST_SITE_TOKEN_SIGNING_DOMAIN,
  GEO_INGEST_TOKEN_ENV,
  GEO_INGEST_TOKEN_SEPARATOR,
  GEO_WEB_KEY_PREFIX,
  GEO_WEB_KEY_SIGNATURE_LENGTH,
  GEO_WEB_KEY_SIGNING_DOMAIN,
  GEO_WEB_PLUS_SCRIPT_PATH,
  GEO_WEB_SCRIPT_PATH,
  GEO_SCRIPT_HOST_RELEASE_DIR,
  GEO_WEB_COLLECT_PATH,
  GEO_WEB_SCRIPT_RELEASE_DIR,
} from "../constants/geo";
import type {
  GeoIngestIdentity,
  GeoIngestSetupInfo,
  GeoIngestSetupResponse,
  GeoIngestSnippets,
  GeoScopeInput,
  GeoWebKeyScope,
  GeoWebScript,
  GeoWebSetupFields,
  GeoWebSetupResponse,
} from "../types/geo";
import { resolveGeoIngestOrigin } from "../utils/geo-ingest-url";
import { geoWebScriptTag } from "../utils/web-script-tag";
import { geoDb } from "./effect";
import { requireGeoProject, resolveGeoScope } from "./projects";

export {
  invalidateGeoIngestHostsCache,
  invalidateGeoIngestHostsCacheForBrand,
} from "./ingest-hosts-cache";

const GENERATION_SEGMENT_REGEX = /^g\d+$/;
const FALLBACK_APP_URL = "https://app.usenotra.com";

/**
 * The organization's or selected project's current tracking-token generation.
 * Read from the database so revocation never depends on a cache write.
 */
export async function getGeoIngestTokenGeneration(
  organizationId: string,
  projectId?: string | null
): Promise<number | null> {
  const row = projectId
    ? await db.query.projects.findFirst({
        columns: { geoIngestTokenGeneration: true },
        where: and(
          eq(projects.id, projectId),
          eq(projects.organizationId, organizationId)
        ),
      })
    : await db.query.organizations.findFirst({
        columns: { geoIngestTokenGeneration: true },
        where: eq(organizations.id, organizationId),
      });
  return row?.geoIngestTokenGeneration ?? null;
}

/**
 * Revoke one project's tokens, or all tokens when no project is provided.
 * Returns the new generation for the requested scope.
 */
async function rotateGeoIngestTokenGeneration(
  organizationId: string,
  projectId?: string | null
): Promise<number | null> {
  if (projectId) {
    const [row] = await db
      .update(projects)
      .set({
        geoIngestTokenGeneration: sql`${projects.geoIngestTokenGeneration} + 1`,
      })
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.organizationId, organizationId)
        )
      )
      .returning({ generation: projects.geoIngestTokenGeneration });
    return row?.generation ?? null;
  }

  return db.transaction(async (tx) => {
    const [organization] = await tx
      .update(organizations)
      .set({
        geoIngestTokenGeneration: sql`${organizations.geoIngestTokenGeneration} + 1`,
      })
      .where(eq(organizations.id, organizationId))
      .returning({ generation: organizations.geoIngestTokenGeneration });
    if (!organization) {
      return null;
    }
    await tx
      .update(projects)
      .set({
        geoIngestTokenGeneration: sql`${projects.geoIngestTokenGeneration} + 1`,
      })
      .where(eq(projects.organizationId, organizationId));
    return organization.generation;
  });
}

/**
 * The current generation of the project's public notra.js key. Null without
 * a project: web keys are never organization-wide.
 */
export async function getGeoWebKeyGeneration(
  organizationId: string,
  projectId: string | null
): Promise<number | null> {
  if (!projectId) {
    return null;
  }
  const row = await db.query.projects.findFirst({
    columns: { geoWebKeyGeneration: true },
    where: and(
      eq(projects.id, projectId),
      eq(projects.organizationId, organizationId)
    ),
  });
  return row?.geoWebKeyGeneration ?? null;
}

/** Revokes the project's public key and returns its new generation. */
async function rotateGeoWebKeyGeneration(
  organizationId: string,
  projectId: string
): Promise<number | null> {
  const [row] = await db
    .update(projects)
    .set({
      geoWebKeyGeneration: sql`${projects.geoWebKeyGeneration} + 1`,
    })
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.organizationId, organizationId)
      )
    )
    .returning({ generation: projects.geoWebKeyGeneration });
  return row?.generation ?? null;
}

export function getGeoIngestSecret(): string | null {
  const secret = process.env[GEO_INGEST_SECRET_ENV];
  return secret && secret.length > 0 ? secret : null;
}

export function isGeoIngestConfigured(): boolean {
  return getGeoIngestSecret() !== null;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function buildGeoIngestToken(
  organizationId: string,
  projectId: string | undefined,
  generation: number
): string | null {
  const secret = getGeoIngestSecret();
  if (!secret) {
    return null;
  }
  const segments = [organizationId];
  if (projectId) {
    segments.push(projectId);
  }
  if (generation > 1) {
    segments.push(`g${generation}`);
  }
  const payload = segments.join(GEO_INGEST_TOKEN_SEPARATOR);
  const signature = sign(payload, secret);
  return `${payload}${GEO_INGEST_TOKEN_SEPARATOR}${signature}`;
}

function signaturesMatch(signature: string, expected: string): boolean {
  const signatureBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  return (
    signatureBytes.length === expectedBytes.length &&
    timingSafeEqual(signatureBytes, expectedBytes)
  );
}

export function buildGeoIngestSiteToken(siteId: string): string | null {
  const secret = getGeoIngestSecret();
  if (!secret) {
    return null;
  }
  const signature = sign(
    `${GEO_INGEST_SITE_TOKEN_SIGNING_DOMAIN}${siteId}`,
    secret
  );
  return `${GEO_INGEST_SITE_TOKEN_PREFIX}${siteId}${GEO_INGEST_TOKEN_SEPARATOR}${signature}`;
}

export function isGeoIngestSiteToken(token: string): boolean {
  return token.startsWith(GEO_INGEST_SITE_TOKEN_PREFIX);
}

export function verifyGeoIngestSiteToken(token: string): string | null {
  const secret = getGeoIngestSecret();
  if (!(secret && isGeoIngestSiteToken(token))) {
    return null;
  }
  const body = token.slice(GEO_INGEST_SITE_TOKEN_PREFIX.length);
  const separatorIndex = body.lastIndexOf(GEO_INGEST_TOKEN_SEPARATOR);
  if (separatorIndex <= 0) {
    return null;
  }
  const siteId = body.slice(0, separatorIndex);
  const expected = sign(
    `${GEO_INGEST_SITE_TOKEN_SIGNING_DOMAIN}${siteId}`,
    secret
  );
  return signaturesMatch(body.slice(separatorIndex + 1), expected)
    ? siteId
    : null;
}

function signWebKey(scope: string, secret: string): string {
  return sign(`${GEO_WEB_KEY_SIGNING_DOMAIN}${scope}`, secret).slice(
    0,
    GEO_WEB_KEY_SIGNATURE_LENGTH
  );
}

/**
 * The public key notra.js carries in page HTML. It is signed so nobody can
 * point a script at another project, but it is not a secret: it can only
 * record human page views on hosts the project already allows. Every key
 * belongs to one project. It survives write-token rotation and has its own
 * generation: generation 0 keys carry no `gN` segment, so keys issued before
 * rotation existed keep working until the first rotation.
 */
export function buildGeoWebKey(
  organizationId: string,
  projectId: string,
  generation = 0
): string | null {
  const secret = getGeoIngestSecret();
  if (!secret) {
    return null;
  }
  const segments = [organizationId, projectId];
  if (generation > 0) {
    segments.push(`g${generation}`);
  }
  const scope = segments.join(GEO_INGEST_TOKEN_SEPARATOR);
  return `${GEO_WEB_KEY_PREFIX}${scope}${GEO_INGEST_TOKEN_SEPARATOR}${signWebKey(scope, secret)}`;
}

/**
 * Generation 0 has no segment and a present one must be `g1` or higher, so
 * each key has exactly one form. Null for anything else.
 */
function parseWebKeyGeneration(segment: string | undefined): number | null {
  if (segment === undefined) {
    return 0;
  }
  if (!GENERATION_SEGMENT_REGEX.test(segment)) {
    return null;
  }
  const generation = Number.parseInt(segment.slice(1), 10);
  return generation >= 1 ? generation : null;
}

export function verifyGeoWebKey(key: string): GeoIngestIdentity | null {
  const secret = getGeoIngestSecret();
  if (!(secret && key.startsWith(GEO_WEB_KEY_PREFIX))) {
    return null;
  }
  const body = key.slice(GEO_WEB_KEY_PREFIX.length);
  const separatorIndex = body.lastIndexOf(GEO_INGEST_TOKEN_SEPARATOR);
  const scope = body.slice(0, Math.max(separatorIndex, 0));
  const [organizationId, projectId, generationSegment, ...rest] = scope.split(
    GEO_INGEST_TOKEN_SEPARATOR
  );
  const generation = parseWebKeyGeneration(generationSegment);
  if (
    !(organizationId && projectId) ||
    rest.length > 0 ||
    generation === null ||
    !signaturesMatch(body.slice(separatorIndex + 1), signWebKey(scope, secret))
  ) {
    return null;
  }
  return { organizationId, projectId, generation, web: true };
}

export function verifyGeoIngestToken(token: string): GeoIngestIdentity | null {
  const secret = getGeoIngestSecret();
  if (!secret) {
    return null;
  }

  const separatorIndex = token.lastIndexOf(GEO_INGEST_TOKEN_SEPARATOR);
  if (separatorIndex <= 0) {
    return null;
  }

  const payload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  if (!signaturesMatch(signature, sign(payload, secret))) {
    return null;
  }

  const segments = payload.split(GEO_INGEST_TOKEN_SEPARATOR);
  let generation = 1;
  const last = segments.at(-1);
  if (segments.length > 1 && last && GENERATION_SEGMENT_REGEX.test(last)) {
    generation = Number.parseInt(last.slice(1), 10);
    segments.pop();
  }

  const [organizationId, projectId] = segments;
  if (!organizationId) {
    return null;
  }

  return { organizationId, projectId: projectId || null, generation };
}

function buildGeoAppUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? FALLBACK_APP_URL;
  return new URL("/", base).origin;
}

function buildGeoIngestUrl(): string {
  const appUrl = buildGeoAppUrl();
  const ingestOrigin = resolveGeoIngestOrigin(
    process.env.GEO_INGEST_URL,
    appUrl
  );
  return new URL(GEO_INGEST_PATH, ingestOrigin ?? appUrl).toString();
}

const PROCESS_TOKEN_EXPR = `process.env.${GEO_INGEST_TOKEN_ENV}!`;
const DENO_TOKEN_EXPR = `Deno.env.get("${GEO_INGEST_TOKEN_ENV}")!`;
const IMPORT_META_TOKEN_EXPR = `import.meta.env.${GEO_INGEST_TOKEN_ENV}!`;
const SVELTEKIT_TOKEN_EXPR = `env.${GEO_INGEST_TOKEN_ENV}!`;

function buildNextSnippet(appUrl: string): string {
  return [
    'import { createGeoProxy } from "@usenotra/geo/next";',
    'import { after, NextResponse } from "next/server";',
    "",
    "const geo = createGeoProxy({",
    `  token: ${PROCESS_TOKEN_EXPR},`,
    `  endpoint: "${appUrl}",`,
    "});",
    "",
    "export function proxy(request: Request) {",
    "  after(() => geo(request));",
    "  return NextResponse.next();",
    "}",
  ].join("\n");
}

function buildNuxtSnippet(appUrl: string): string {
  return [
    'import { createGeoHandler } from "@usenotra/geo/nuxt";',
    "",
    "const geo = createGeoHandler({",
    `  token: ${PROCESS_TOKEN_EXPR},`,
    `  endpoint: "${appUrl}",`,
    "});",
    "",
    "export default defineEventHandler(async (event) => {",
    "  await geo(event);",
    "});",
  ].join("\n");
}

function buildNetlifySnippet(appUrl: string): string {
  return [
    'import { createGeoHandler } from "@usenotra/geo/netlify";',
    'import type { Context } from "@netlify/edge-functions";',
    "",
    "const geo = createGeoHandler({",
    `  token: ${DENO_TOKEN_EXPR},`,
    `  endpoint: "${appUrl}",`,
    "});",
    "",
    "export default (request: Request, context: Context) => {",
    "  geo(request, context);",
    "};",
    "",
    'export const config = { path: "/*" };',
  ].join("\n");
}

function buildTanStackSnippet(appUrl: string): string {
  return [
    'import { createMiddleware, createStart } from "@tanstack/react-start";',
    'import { createGeoMiddleware } from "@usenotra/geo/tanstack";',
    "",
    "const geo = createMiddleware().server(createGeoMiddleware({",
    `  token: ${PROCESS_TOKEN_EXPR},`,
    `  endpoint: "${appUrl}",`,
    "}));",
    "",
    "export const startInstance = createStart(() => ({",
    "  requestMiddleware: [geo],",
    "}));",
  ].join("\n");
}

function buildAstroSnippet(appUrl: string): string {
  return [
    'import { createGeoMiddleware } from "@usenotra/geo/astro";',
    "",
    "export const onRequest = createGeoMiddleware({",
    `  token: ${IMPORT_META_TOKEN_EXPR},`,
    `  endpoint: "${appUrl}",`,
    "});",
  ].join("\n");
}

function buildSvelteKitSnippet(appUrl: string): string {
  return [
    'import { env } from "$env/dynamic/private";',
    'import { createGeoHandle } from "@usenotra/geo/sveltekit";',
    "",
    "export const handle = createGeoHandle({",
    `  token: ${SVELTEKIT_TOKEN_EXPR},`,
    `  endpoint: "${appUrl}",`,
    "});",
  ].join("\n");
}

function buildReactRouterSnippet(appUrl: string): string {
  return [
    'import { createGeoMiddleware } from "@usenotra/geo/react-router";',
    'import type { Route } from "./+types/root";',
    "",
    "const geo = createGeoMiddleware({",
    `  token: ${PROCESS_TOKEN_EXPR},`,
    `  endpoint: "${appUrl}",`,
    "});",
    "",
    "export const middleware: Route.MiddlewareFunction[] = [geo];",
  ].join("\n");
}

function buildGeoSnippets(appUrl: string): GeoIngestSnippets {
  return {
    next: buildNextSnippet(appUrl),
    nuxt: buildNuxtSnippet(appUrl),
    netlify: buildNetlifySnippet(appUrl),
    tanstack: buildTanStackSnippet(appUrl),
    astro: buildAstroSnippet(appUrl),
    sveltekit: buildSvelteKitSnippet(appUrl),
    reactRouter: buildReactRouterSnippet(appUrl),
  };
}

/**
 * The install payload without the token.
 *
 * The snippets name the token's environment variable rather than its value, so
 * nothing here is a credential. That matters for the public API: reading setup
 * only costs `traffic.read`, while the token is a write credential (it lets the
 * holder post events), so the read path builds this and never the token.
 */
export function buildGeoIngestSetupInfo(): GeoIngestSetupInfo {
  const ingestUrl = buildGeoIngestUrl();
  const { origin } = new URL(ingestUrl);
  const snippets = buildGeoSnippets(origin);
  return {
    ingestUrl,
    snippet: snippets.next,
    snippets,
    drainUrls: {
      vercel: new URL(GEO_DRAIN_PATHS.vercel, origin).toString(),
      cloudflare: new URL(GEO_DRAIN_PATHS.cloudflare, origin).toString(),
    },
  };
}

/**
 * Where a notra.js build loads from: the script host in `GEO_SCRIPT_URL` (the
 * notra-script Worker on Cloudflare's edge) when one is set, with page views
 * pointed back at the ingest, otherwise the ingest itself.
 */
function webScript(
  ingestUrl: string,
  path: string,
  release: TrackerReleaseLink
): GeoWebScript {
  const scriptOrigin = resolveGeoIngestOrigin(
    process.env.GEO_SCRIPT_URL,
    undefined
  );
  if (scriptOrigin && scriptOrigin !== new URL(ingestUrl).origin) {
    const file = path.slice(path.lastIndexOf("/") + 1);
    return {
      url: new URL(
        `${GEO_SCRIPT_HOST_RELEASE_DIR}${file}`,
        scriptOrigin
      ).toString(),
      pinnedUrl: new URL(
        `${GEO_SCRIPT_HOST_RELEASE_DIR}${release.file}`,
        scriptOrigin
      ).toString(),
      integrity: release.integrity,
      collectUrl: new URL(GEO_WEB_COLLECT_PATH, ingestUrl).toString(),
    };
  }
  return {
    url: new URL(path, ingestUrl).toString(),
    pinnedUrl: new URL(
      `${GEO_WEB_SCRIPT_RELEASE_DIR}${release.file}`,
      ingestUrl
    ).toString(),
    integrity: release.integrity,
  };
}

/**
 * The notra.js fields for a project's key. The web key only records page
 * views on the project's tracked domains and ships in page HTML, so this is
 * not a credential. Empty without a project: web keys are never
 * organization-wide.
 */
function buildGeoWebSetupFields(
  organizationId: string,
  ingestUrl: string,
  web: GeoWebKeyScope | null
): Partial<GeoWebSetupFields> {
  if (!web) {
    return {};
  }
  const webKey =
    buildGeoWebKey(organizationId, web.projectId, web.generation) ?? "";
  const script = webScript(ingestUrl, GEO_WEB_SCRIPT_PATH, TRACKER_RELEASE);
  return {
    webKey,
    webSnippet: geoWebScriptTag(webKey, script),
    webScript: script,
    webPlusScript: webScript(
      ingestUrl,
      GEO_WEB_PLUS_SCRIPT_PATH,
      TRACKER_PLUS_RELEASE
    ),
  };
}

function buildGeoWebSetupResponse(
  organizationId: string,
  web: GeoWebKeyScope | null
): GeoWebSetupResponse {
  const info = buildGeoIngestSetupInfo();
  return {
    ...info,
    ...buildGeoWebSetupFields(organizationId, info.ingestUrl, web),
  };
}

/**
 * The full "how do I install tracking" payload, token included.
 *
 * Shared by the dashboard and the public API so both surfaces answer
 * identically. `token` is `""` when `GEO_INGEST_SECRET`
 * is unset — the dashboard renders that as "not configured yet"; the public API
 * turns it into a 503 instead, because an empty token is not a usable answer.
 */
function buildGeoIngestSetupResponse(
  input: GeoScopeInput,
  generation: number,
  web: GeoWebKeyScope | null
): GeoIngestSetupResponse {
  return {
    ...buildGeoWebSetupResponse(input.organizationId, web),
    token:
      buildGeoIngestToken(input.organizationId, input.projectId, generation) ??
      "",
  };
}

/**
 * The project whose web key the scope uses, resolved like every read: the
 * given project after proving it belongs to the organization, otherwise the
 * organization's oldest. Null when the organization has no project, and
 * without web analytics, which only proves a given project.
 */
const resolveGeoWebKeyScope = Effect.fn("geo.ingest.webKeyScope")(function* (
  input: GeoScopeInput,
  withWeb: boolean
) {
  if (!withWeb) {
    if (input.projectId) {
      yield* resolveGeoScope(input);
    }
    return null;
  }
  const { projectId } = yield* resolveGeoScope(input);
  if (!projectId) {
    return null;
  }
  const generation = yield* geoDb("web key generation lookup failed", () =>
    getGeoWebKeyGeneration(input.organizationId, projectId)
  );
  return generation === null ? null : { projectId, generation };
});

/** The tokenless install payload for read access. */
export const loadGeoWebSetupResponse = Effect.fn("geo.ingest.webSetup")(
  function* (input: GeoScopeInput) {
    const web = yield* resolveGeoWebKeyScope(input, true);
    return buildGeoWebSetupResponse(input.organizationId, web);
  }
);

/**
 * Issues a token only after proving an optional project belongs to the
 * organization. A missing organization returns `null` rather than signing a
 * generation-one token for an identity that does not exist. `withWeb: false`
 * leaves notra.js out for workspaces without web analytics.
 */
export const issueGeoIngestSetupResponse = Effect.fn("geo.ingest.issueSetup")(
  function* (input: GeoScopeInput, withWeb = true) {
    const web = yield* resolveGeoWebKeyScope(input, withWeb);
    const generation = yield* geoDb(
      "ingest token generation lookup failed",
      () => getGeoIngestTokenGeneration(input.organizationId, input.projectId)
    );
    if (generation === null) {
      return null;
    }
    return buildGeoIngestSetupResponse(input, generation, web);
  }
);

/**
 * Validates the optional project before revoking existing tokens. This order
 * matters: a caller must not be able to bump the organization's generation by
 * supplying a project owned by somebody else.
 */
export const rotateGeoIngestSetupResponse = Effect.fn("geo.ingest.rotateSetup")(
  function* (input: GeoScopeInput, withWeb = true) {
    const web = yield* resolveGeoWebKeyScope(input, withWeb);
    const generation = yield* geoDb("ingest token rotation failed", () =>
      rotateGeoIngestTokenGeneration(input.organizationId, input.projectId)
    );
    if (generation === null) {
      return null;
    }
    return buildGeoIngestSetupResponse(input, generation, web);
  }
);

/**
 * Revokes the scope's public notra.js key: pages with the old key stop
 * counting until they get the new snippet. Without a project there is no key
 * to rotate.
 */
export const rotateGeoWebKeySetupResponse = Effect.fn(
  "geo.ingest.rotateWebKeySetup"
)(function* (input: GeoScopeInput) {
  const { projectId } = yield* requireGeoProject(input);
  const webGeneration = yield* geoDb("web key rotation failed", () =>
    rotateGeoWebKeyGeneration(input.organizationId, projectId)
  );
  const generation = yield* geoDb("ingest token generation lookup failed", () =>
    getGeoIngestTokenGeneration(input.organizationId, input.projectId)
  );
  if (generation === null || webGeneration === null) {
    return null;
  }
  return buildGeoIngestSetupResponse(input, generation, {
    projectId,
    generation: webGeneration,
  });
});
