import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  spyOn,
  test,
} from "bun:test";
import { randomBytes } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

// Runs only against a disposable loopback database that already has every
// migration applied (CI replays them into notra_migrations). The refresh path
// needs separate connections to prove concurrent callers share one refresh.
const allowedHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
const candidateUrl = process.env.DATABASE_URL;
const databaseUrl =
  candidateUrl &&
  URL.canParse(candidateUrl) &&
  new URL(candidateUrl).search === "" &&
  allowedHosts.has(new URL(candidateUrl).hostname) &&
  new URL(candidateUrl).pathname === "/notra_migrations"
    ? candidateUrl
    : undefined;

process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.LINEAR_CLIENT_ID = "test-client";
process.env.LINEAR_CLIENT_SECRET = "test-secret";

const { LINEAR_OAUTH_TOKEN_URL } = await import("../constants/linear");
const {
  connectLinearIntegration,
  exchangeLinearAuthorizationCode,
  refreshDueLinearAccessTokens,
  resolveLinearAccessToken,
} = await import("./linear-oauth");
const { LinearReconnectRequiredError, LinearTokenRequestError } =
  await import("./linear-oauth-errors");
const { getLinearToolContextByIntegrationId } = await import("./linear");
const { describeLinearToolError } = await import("../utils/linear");
const { LINEAR_TOOL_ERROR_MESSAGES } = await import("../constants/linear");

const HOUR_MS = 60 * 60 * 1000;

/**
 * Follows Linear's documented behaviour: every refresh rotates the pair, and
 * replaying a rotated refresh token (within 30 minutes) returns the
 * replacement instead of failing.
 */
class FakeLinearTokenEndpoint {
  calls = 0;
  failWith: string | null = null;
  serverErrorsLeft = 0;
  loseNextResponse = false;
  private issued = 0;
  private readonly validRefreshTokens = new Set<string>();
  private readonly replacements = new Map<
    string,
    ReturnType<FakeLinearTokenEndpoint["issue"]>
  >();

  issue() {
    this.issued += 1;
    const refreshToken = `refresh-${this.issued}-${crypto.randomUUID()}`;
    this.validRefreshTokens.add(refreshToken);
    return {
      access_token: `access-${this.issued}-${crypto.randomUUID()}`,
      refresh_token: refreshToken,
      expires_in: 86_399,
      token_type: "Bearer",
      scope: "read",
    };
  }

  async handle(body: URLSearchParams): Promise<Response> {
    this.calls += 1;
    await sleep(40);
    if (this.serverErrorsLeft > 0) {
      this.serverErrorsLeft -= 1;
      return Response.json({ error: "server_error" }, { status: 503 });
    }
    if (
      this.failWith ||
      body.get("client_id") !== "test-client" ||
      body.get("client_secret") !== "test-secret"
    ) {
      return Response.json(
        { error: this.failWith ?? "invalid_client" },
        { status: 400 }
      );
    }
    if (body.get("grant_type") !== "refresh_token") {
      return Response.json(this.issue());
    }
    const refreshToken = body.get("refresh_token") ?? "";
    const replayed = this.replacements.get(refreshToken);
    if (replayed) {
      return Response.json(replayed);
    }
    if (!this.validRefreshTokens.delete(refreshToken)) {
      return Response.json({ error: "invalid_grant" }, { status: 400 });
    }
    const replacement = this.issue();
    this.replacements.set(refreshToken, replacement);
    if (this.loseNextResponse) {
      this.loseNextResponse = false;
      throw new TypeError("fetch failed");
    }
    return Response.json(replacement);
  }
}

describe.skipIf(!databaseUrl)("Linear OAuth tokens on PostgreSQL", () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const organizationId = `org-linear-${suffix}`;
  const userId = `user-linear-${suffix}`;
  let linear: FakeLinearTokenEndpoint;
  let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
  let db: typeof import("@notra/db/drizzle").db;
  let schema: typeof import("@notra/db/schema");
  let eq: typeof import("drizzle-orm").eq;

  const row = async (id: string) => {
    const [found] = await db
      .select()
      .from(schema.linearIntegrations)
      .where(eq(schema.linearIntegrations.id, id));
    if (!found) {
      throw new Error(`missing integration ${id}`);
    }
    return found;
  };
  const expireIn = (id: string, ms: number) =>
    db
      .update(schema.linearIntegrations)
      .set({ accessTokenExpiresAt: new Date(Date.now() + ms) })
      .where(eq(schema.linearIntegrations.id, id));
  const connect = async (linearOrganizationId: string) => {
    const tokens = await exchangeLinearAuthorizationCode({
      code: "authorization-code",
      redirectUri: "https://app.example.test/api/integrations/linear/callback",
      credentials: { clientId: "test-client", clientSecret: "test-secret" },
    });
    const result = await connectLinearIntegration({
      organizationId,
      userId,
      linearOrganizationId,
      linearOrganizationName: "Acme",
      tokens,
    });
    return { ...result, tokens };
  };

  beforeAll(async () => {
    ({ db } = await import("@notra/db/drizzle"));
    schema = await import("@notra/db/schema");
    ({ eq } = await import("drizzle-orm"));
    await db.insert(schema.users).values({
      id: userId,
      name: "Linear Test",
      email: `${userId}@example.test`,
    });
    await db.insert(schema.organizations).values({
      id: organizationId,
      name: "Linear Test",
      slug: organizationId,
      createdAt: new Date(),
    });
    await db.insert(schema.members).values({
      id: `member-${suffix}`,
      organizationId,
      userId,
      role: "owner",
      createdAt: new Date(),
    });
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
    process.env.LINEAR_CLIENT_ID = "test-client";
    process.env.LINEAR_CLIENT_SECRET = "test-secret";
  });

  afterAll(async () => {
    await db
      .delete(schema.organizations)
      .where(eq(schema.organizations.id, organizationId));
    await db.delete(schema.users).where(eq(schema.users.id, userId));
    await db.$client.end();
  });

  const useFakeLinear = () => {
    linear = new FakeLinearTokenEndpoint();
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (
      input: string | URL | Request,
      init?: RequestInit
    ) => {
      if (String(input) !== LINEAR_OAUTH_TOKEN_URL) {
        throw new Error(`unexpected request to ${String(input)}`);
      }
      return await linear.handle(new URLSearchParams(String(init?.body)));
    }) as typeof fetch);
  };

  test("connecting stores the refresh token and reconnecting replaces it in place", async () => {
    useFakeLinear();
    const first = await connect(`lin-org-connect-${suffix}`);
    expect(first.reconnected).toBe(false);

    await db
      .update(schema.linearIntegrations)
      .set({
        displayName: "Renamed by user",
        linearTeamId: "team-1",
        encryptedRefreshToken: null,
      })
      .where(eq(schema.linearIntegrations.id, first.integrationId));

    const second = await connect(`lin-org-connect-${suffix}`);
    expect(second).toMatchObject({
      integrationId: first.integrationId,
      reconnected: true,
    });

    const saved = await row(first.integrationId);
    expect(saved.displayName).toBe("Renamed by user");
    expect(saved.linearTeamId).toBe("team-1");
    expect(saved.encryptedRefreshToken).not.toBeNull();
    expect(saved.encryptedAccessToken).not.toContain(second.tokens.accessToken);
    expect(await resolveLinearAccessToken(saved)).toBe(
      second.tokens.accessToken
    );
    expect(saved.accessTokenExpiresAt?.getTime()).toBeGreaterThan(
      Date.now() + 23 * HOUR_MS
    );
  });

  test("a valid token is used without calling Linear", async () => {
    useFakeLinear();
    const { integrationId, tokens } = await connect(`lin-org-fresh-${suffix}`);
    const callsAfterConnect = linear.calls;

    const context = await getLinearToolContextByIntegrationId(integrationId, {
      organizationId,
    });
    expect(context.accessToken).toBe(tokens.accessToken);
    expect(linear.calls).toBe(callsAfterConnect);
  });

  test("concurrent callers with an expired token share a single rotation", async () => {
    useFakeLinear();
    const { integrationId, tokens } = await connect(`lin-org-race-${suffix}`);
    await expireIn(integrationId, -HOUR_MS);
    const callsBefore = linear.calls;

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        getLinearToolContextByIntegrationId(integrationId, { organizationId })
      )
    );

    expect(linear.calls - callsBefore).toBe(1);
    const accessTokens = new Set(results.map((result) => result.accessToken));
    expect(accessTokens.size).toBe(1);
    expect(accessTokens.has(tokens.accessToken)).toBe(false);

    const saved = await row(integrationId);
    expect(saved.accessTokenExpiresAt?.getTime()).toBeGreaterThan(
      Date.now() + 23 * HOUR_MS
    );
    // The rotated refresh token keeps working on the next refresh.
    await expireIn(integrationId, -HOUR_MS);
    const next = await resolveLinearAccessToken(await row(integrationId));
    expect(accessTokens.has(next)).toBe(false);
    expect(linear.calls - callsBefore).toBe(2);
  });

  test("a revoked refresh token asks for a reconnect and stops retrying", async () => {
    useFakeLinear();
    const { integrationId } = await connect(`lin-org-revoked-${suffix}`);
    await db
      .update(schema.linearIntegrations)
      .set({
        encryptedRefreshToken: (
          await import("@notra/db/utils/integration-encryption")
        ).encryptToken("revoked-refresh-token"),
        accessTokenExpiresAt: new Date(Date.now() - HOUR_MS),
      })
      .where(eq(schema.linearIntegrations.id, integrationId));

    const error = await resolveLinearAccessToken(
      await row(integrationId)
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(LinearReconnectRequiredError);
    expect(describeLinearToolError(error)).toBe(
      LINEAR_TOOL_ERROR_MESSAGES.auth
    );
    expect((await row(integrationId)).encryptedRefreshToken).toBeNull();

    const callsAfterRevocation = linear.calls;
    await expect(
      resolveLinearAccessToken(await row(integrationId))
    ).rejects.toBeInstanceOf(LinearReconnectRequiredError);
    expect(linear.calls).toBe(callsAfterRevocation);
  });

  test("a client configuration error keeps the stored authorization", async () => {
    useFakeLinear();
    const { integrationId } = await connect(`lin-org-client-${suffix}`);
    await expireIn(integrationId, -HOUR_MS);
    const before = await row(integrationId);
    linear.failWith = "invalid_client";
    const callsBefore = linear.calls;

    await expect(resolveLinearAccessToken(before)).rejects.toBeInstanceOf(
      LinearTokenRequestError
    );
    expect(linear.calls - callsBefore).toBe(1);
    const after = await row(integrationId);
    expect(after.encryptedRefreshToken).toBe(before.encryptedRefreshToken);
    expect(after.encryptedAccessToken).toBe(before.encryptedAccessToken);
  });

  test("a refresh whose response was lost is recovered by replaying the old token", async () => {
    useFakeLinear();
    const { integrationId, tokens } = await connect(`lin-org-lost-${suffix}`);
    await expireIn(integrationId, -HOUR_MS);
    const callsBefore = linear.calls;
    linear.loseNextResponse = true;

    const recovered = await resolveLinearAccessToken(await row(integrationId));

    expect(recovered).not.toBe(tokens.accessToken);
    expect(linear.calls - callsBefore).toBe(2);
    // The saved refresh token is the replacement, so the next rotation works.
    await expireIn(integrationId, -HOUR_MS);
    const next = await resolveLinearAccessToken(await row(integrationId));
    expect(next).not.toBe(recovered);
    expect((await row(integrationId)).encryptedRefreshToken).not.toBeNull();
  });

  test("server errors from Linear are retried", async () => {
    useFakeLinear();
    const { integrationId, tokens } = await connect(`lin-org-5xx-${suffix}`);
    await expireIn(integrationId, -HOUR_MS);
    const callsBefore = linear.calls;
    linear.serverErrorsLeft = 1;

    const accessToken = await resolveLinearAccessToken(
      await row(integrationId)
    );

    expect(accessToken).not.toBe(tokens.accessToken);
    expect(linear.calls - callsBefore).toBe(2);
  });

  test("services without the client secret use a token until it lapses", async () => {
    useFakeLinear();
    const { integrationId, tokens } = await connect(
      `lin-org-no-secret-${suffix}`
    );
    delete process.env.LINEAR_CLIENT_SECRET;
    const callsBefore = linear.calls;

    await expireIn(integrationId, 60_000);
    expect(await resolveLinearAccessToken(await row(integrationId))).toBe(
      tokens.accessToken
    );

    await expireIn(integrationId, -60_000);
    await expect(
      resolveLinearAccessToken(await row(integrationId))
    ).rejects.toThrow("LINEAR_CLIENT_SECRET");
    expect(linear.calls).toBe(callsBefore);
    expect((await row(integrationId)).encryptedRefreshToken).not.toBeNull();
  });

  test("legacy integrations without a refresh token keep their stored token", async () => {
    useFakeLinear();
    const integrationId = `lin_legacy_${suffix}`;
    const { encryptToken } =
      await import("@notra/db/utils/integration-encryption");
    await db.insert(schema.linearIntegrations).values({
      id: integrationId,
      organizationId,
      createdByUserId: userId,
      displayName: "Legacy",
      linearOrganizationId: `lin-org-legacy-${suffix}`,
      encryptedAccessToken: encryptToken("legacy-access-token"),
    });

    expect(await resolveLinearAccessToken(await row(integrationId))).toBe(
      "legacy-access-token"
    );
    expect(linear.calls).toBe(0);
  });

  test("rows that share an authorization are refreshed together", async () => {
    useFakeLinear();
    const linearOrganizationId = `lin-org-shared-${suffix}`;
    const { integrationId } = await connect(linearOrganizationId);
    const original = await row(integrationId);
    const twinId = `lin_twin_${suffix}`;
    await db.insert(schema.linearIntegrations).values({
      ...original,
      id: twinId,
      linearTeamId: "team-twin",
    });
    await expireIn(integrationId, -HOUR_MS);
    await expireIn(twinId, -HOUR_MS);

    const fromFirst = await resolveLinearAccessToken(await row(integrationId));
    const callsAfterFirst = linear.calls;
    const fromTwin = await resolveLinearAccessToken(await row(twinId));

    expect(fromTwin).toBe(fromFirst);
    expect(linear.calls).toBe(callsAfterFirst);
    expect((await row(twinId)).encryptedRefreshToken).toBe(
      (await row(integrationId)).encryptedRefreshToken
    );
  });

  test("the scheduled refresh renews only authorizations close to expiry", async () => {
    useFakeLinear();
    const dueSoon = await connect(`lin-org-due-${suffix}`);
    const healthy = await connect(`lin-org-healthy-${suffix}`);
    const revoked = await connect(`lin-org-due-revoked-${suffix}`);
    await expireIn(dueSoon.integrationId, 2 * HOUR_MS);
    await expireIn(healthy.integrationId, 20 * HOUR_MS);
    await expireIn(revoked.integrationId, HOUR_MS);
    const { encryptToken } =
      await import("@notra/db/utils/integration-encryption");
    await db
      .update(schema.linearIntegrations)
      .set({ encryptedRefreshToken: encryptToken("revoked-refresh-token") })
      .where(eq(schema.linearIntegrations.id, revoked.integrationId));
    const healthyBefore = await row(healthy.integrationId);

    const summary = await refreshDueLinearAccessTokens();

    // Rows left over from earlier tests in this database may also be due.
    expect(summary.refreshed).toBeGreaterThanOrEqual(1);
    expect(summary.reconnectRequired).toBeGreaterThanOrEqual(1);
    expect(summary.failed).toBe(0);
    expect(
      (await row(dueSoon.integrationId)).accessTokenExpiresAt?.getTime()
    ).toBeGreaterThan(Date.now() + 23 * HOUR_MS);
    expect(await row(healthy.integrationId)).toEqual(healthyBefore);
    expect((await row(revoked.integrationId)).encryptedRefreshToken).toBeNull();
  });

  test("the scheduled refresh leaves work past its time budget for the next run", async () => {
    useFakeLinear();
    const { integrationId } = await connect(`lin-org-budget-${suffix}`);
    await expireIn(integrationId, HOUR_MS);
    const before = await row(integrationId);

    const summary = await refreshDueLinearAccessTokens({ budgetMs: 0 });

    expect(summary.refreshed).toBe(0);
    expect(summary.deferred).toBe(summary.due);
    expect(summary.deferred).toBeGreaterThanOrEqual(1);
    expect(await row(integrationId)).toEqual(before);
  });
});
