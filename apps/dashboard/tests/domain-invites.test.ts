import { beforeEach, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.env.NOTRA_DOMAIN_INVITES_TEST_WORKER !== "1") {
  test("domain auto-invites only trust shared company domains", () => {
    const result = spawnSync(
      process.execPath,
      ["test", fileURLToPath(import.meta.url)],
      {
        env: { ...process.env, NOTRA_DOMAIN_INVITES_TEST_WORKER: "1" },
        timeout: 30_000,
      }
    );
    expect(result.status, result.stderr?.toString()).toBe(0);
  }, 35_000);
} else {
  const FUTURE = new Date(Date.now() + 86_400_000).toISOString();
  const PAST = "2026-01-02T00:00:00.000Z";
  const invitation = (
    organizationId: string,
    token: string,
    overrides: Record<string, unknown> = {}
  ) => ({
    organizationId,
    token,
    state: "pending",
    expiresAt: FUTURE,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });
  const verified = (email: string) => ({ email, emailVerified: true });

  const state = {
    workspaces: [] as {
      id: string;
      workosOrgId: string | null;
      autoInviteDomain: string | null;
    }[],
    existing: [] as ReturnType<typeof invitation>[],
    laterPages: [] as ReturnType<typeof invitation>[][],
    limit: "allowed",
    sendFails: false,
    listFails: false,
  };
  const setDomain = mock((_values: unknown) => ({ where: async () => [] }));
  const listInvitations = mock(async ({ after }: { after?: string }) => {
    if (state.listFails) {
      throw new Error("WorkOS unavailable");
    }
    const pages = [state.existing, ...state.laterPages];
    const index = after ? Number(after) : 0;
    return {
      data: pages[index] ?? [],
      listMetadata: {
        after: index + 1 < pages.length ? String(index + 1) : null,
      },
    };
  });
  const sendInvitation = mock(
    async ({ organizationId }: { organizationId: string }) => {
      if (state.sendFails) {
        throw new Error("WorkOS unavailable");
      }
      return invitation(organizationId, `sent-${organizationId}`, {
        createdAt: "2026-06-01T00:00:00.000Z",
      });
    }
  );

  // Filters the fake tables by the real query values, so a wrong domain fails.
  const drizzle = await import("drizzle-orm");
  type Filter = { column: string; values: unknown[] };
  const columnName = (column: unknown) => (column as { name: string }).name;
  mock.module("drizzle-orm", () => ({
    ...drizzle,
    eq: (column: unknown, value: unknown): Filter => ({
      column: columnName(column),
      values: [value],
    }),
    inArray: (column: unknown, values: unknown[]): Filter => ({
      column: columnName(column),
      values,
    }),
  }));
  mock.module("@notra/db/drizzle", () => ({
    db: {
      update: () => ({ set: setDomain }),
      query: {
        organizations: {
          findMany: async ({ where }: { where: Filter }) =>
            state.workspaces.filter((workspace) =>
              where.values.includes(
                where.column === "auto_invite_domain"
                  ? workspace.autoInviteDomain
                  : workspace.workosOrgId
              )
            ),
        },
      },
    },
  }));
  mock.module("@notra/ai/billing/team-members", () => ({
    checkTeamMembersLimit: async () => state.limit,
  }));
  mock.module("@notra/ai/utils/server-log", () => ({ logError: () => {} }));
  mock.module("@workos/authkit-session", () => ({
    getWorkOS: () => ({
      userManagement: { sendInvitation, listInvitations },
    }),
  }));

  const {
    autoInviteDomainFor,
    ensureDomainInvitations,
    pendingInvitationHref,
    setAutoInviteDomain,
  } = await import("../src/lib/organizations/domain-invites");

  beforeEach(() => {
    setDomain.mockClear();
    sendInvitation.mockClear();
    listInvitations.mockClear();
    state.workspaces = [
      { id: "org_a", workosOrgId: "workos_a", autoInviteDomain: "acme.com" },
      { id: "org_b", workosOrgId: null, autoInviteDomain: "acme.com" },
      { id: "org_c", workosOrgId: "workos_c", autoInviteDomain: "other.com" },
    ];
    state.existing = [];
    state.laterPages = [];
    state.limit = "allowed";
    state.sendFails = false;
    state.listFails = false;
  });

  test("only an admin's own verified company domain is eligible", () => {
    expect(autoInviteDomainFor(verified("Jan@Ontora.COM"))).toBe("ontora.com");
    expect(
      autoInviteDomainFor({ email: "jan@ontora.com", emailVerified: false })
    ).toBeNull();
    for (const email of [
      "jan@gmail.com",
      "jan@mailinator.com",
      "jan@stanford.edu",
      "jan@ox.ac.uk",
      "jan@student.unimelb.edu.au",
    ]) {
      expect(autoInviteDomainFor(verified(email))).toBeNull();
    }
  });

  test("stores and clears the domain", async () => {
    await setAutoInviteDomain("org_a", "ontora.com");
    await setAutoInviteDomain("org_a", null);
    expect(setDomain.mock.calls).toEqual([
      [{ autoInviteDomain: "ontora.com" }],
      [{ autoInviteDomain: null }],
    ]);
  });

  test("invites a signup only to workspaces on their own domain", async () => {
    expect(await ensureDomainInvitations(verified("new@acme.com"))).toBe(
      "sent-workos_a"
    );
    expect(sendInvitation).toHaveBeenCalledTimes(1);
    expect(sendInvitation).toHaveBeenCalledWith({
      email: "new@acme.com",
      organizationId: "workos_a",
      roleSlug: "member",
    });
    expect(listInvitations).toHaveBeenCalledWith({
      email: "new@acme.com",
      limit: 100,
    });
  });

  test("skips unverified users, free emails and full workspaces", async () => {
    expect(
      await ensureDomainInvitations({
        email: "new@acme.com",
        emailVerified: false,
      })
    ).toBeNull();
    expect(listInvitations).not.toHaveBeenCalled();
    expect(await ensureDomainInvitations(verified("new@gmail.com"))).toBeNull();
    state.limit = "limit-reached";
    expect(await ensureDomainInvitations(verified("new@acme.com"))).toBeNull();
    expect(sendInvitation).not.toHaveBeenCalled();
  });

  test("never re-invites after an invitation was declined", async () => {
    state.existing = [invitation("workos_a", "old", { state: "revoked" })];
    expect(await ensureDomainInvitations(verified("new@acme.com"))).toBeNull();
    expect(sendInvitation).not.toHaveBeenCalled();
  });

  test("reads every page before deciding a workspace never invited", async () => {
    state.existing = [
      invitation("workos_x", "unrelated", { state: "revoked" }),
    ];
    state.laterPages = [[invitation("workos_a", "old", { state: "revoked" })]];
    expect(await ensureDomainInvitations(verified("new@acme.com"))).toBeNull();
    expect(listInvitations).toHaveBeenCalledTimes(2);
    expect(listInvitations).toHaveBeenLastCalledWith({
      email: "new@acme.com",
      limit: 100,
      after: "1",
    });
    expect(sendInvitation).not.toHaveBeenCalled();
  });

  test("reuses a pending invitation instead of sending another", async () => {
    state.existing = [invitation("workos_a", "manual")];
    expect(await ensureDomainInvitations(verified("new@acme.com"))).toBe(
      "manual"
    );
    expect(sendInvitation).not.toHaveBeenCalled();
  });

  test("replaces an expired invitation", async () => {
    state.existing = [
      invitation("workos_a", "stale", { expiresAt: PAST }),
      invitation("workos_a", "older", { state: "expired", expiresAt: PAST }),
    ];
    expect(await ensureDomainInvitations(verified("new@acme.com"))).toBe(
      "sent-workos_a"
    );
    expect(sendInvitation).toHaveBeenCalledTimes(1);
  });

  test("retries a failed send on the next visit", async () => {
    state.sendFails = true;
    expect(await ensureDomainInvitations(verified("new@acme.com"))).toBeNull();
    state.sendFails = false;
    expect(await ensureDomainInvitations(verified("new@acme.com"))).toBe(
      "sent-workos_a"
    );
    expect(sendInvitation).toHaveBeenCalledTimes(2);
  });

  test("a WorkOS outage falls back to onboarding instead of throwing", async () => {
    state.listFails = true;
    expect(await pendingInvitationHref(verified("new@acme.com"))).toBeNull();
    state.listFails = false;
    expect(await pendingInvitationHref(verified("new@acme.com"))).toBe(
      "/invitation?invitation_token=sent-workos_a"
    );
  });

  test("skips invitations to deleted workspaces and picks the newest", async () => {
    state.workspaces = [
      { id: "org_old", workosOrgId: "workos_old", autoInviteDomain: null },
      { id: "org_new", workosOrgId: "workos_new", autoInviteDomain: null },
    ];
    state.existing = [
      invitation("workos_deleted", "dead", {
        createdAt: "2026-09-01T00:00:00.000Z",
      }),
      invitation("workos_old", "old"),
      invitation("workos_new", "new", {
        createdAt: "2026-03-01T00:00:00.000Z",
      }),
      invitation("workos_new", "expired", {
        createdAt: "2026-08-01T00:00:00.000Z",
        expiresAt: PAST,
      }),
    ];
    expect(await ensureDomainInvitations(verified("new@other.com"))).toBe(
      "new"
    );
  });
}
