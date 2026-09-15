import { describe, expect, mock, test } from "bun:test";

import { getWorkspacesResponseSchema } from "@notra/schemas/api/workspaces";
import { isUnscopedApiPath } from "@notra/utils/api-scopes";

import { workspaceRoutes } from "../src/routes/workspaces";
import type { AuthData } from "../src/types/auth";
import { getApiAuthRequirements } from "../src/utils/auth-scopes";
import { createOpenApiApp } from "../src/utils/openapi-app";
import { paginateWorkspaces } from "../src/utils/workspace-pagination";
import { getWorkspaceContext } from "../src/utils/workspaces";

const currentWorkspace = {
  id: "org_current",
  slug: "current",
  name: "Current workspace",
  logo: null,
};

function createDb(
  workspaces = [
    {
      role: "owner",
      organizations: currentWorkspace,
    },
  ],
  pendingOrganizations = []
) {
  return {
    query: {
      organizations: {
        findFirst: mock(async () => currentWorkspace),
        findMany: mock(async () => pendingOrganizations),
      },
      members: {
        findMany: mock(async () => workspaces),
      },
      users: {
        findFirst: mock(async () => ({ email: "member@example.com" })),
      },
    },
  };
}

function createWorkspaceApp(auth: AuthData, db = createDb()) {
  const app = createOpenApiApp();
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", db);
    await next();
  });
  app.route("/", workspaceRoutes);
  return app;
}

describe("workspace context", () => {
  test("API keys only receive their current workspace", async () => {
    const db = createDb();
    const auth = {
      keyId: "key_test",
      identity: { externalId: currentWorkspace.id },
    } as AuthData;

    const response = await getWorkspaceContext(db, auth, currentWorkspace.id);

    expect(response).toEqual({
      currentWorkspace,
      workspaces: [
        {
          ...currentWorkspace,
          role: null,
          status: "active",
          isCurrent: true,
        },
      ],
      authentication: { type: "apiKey" },
    });
    expect(db.query.members.findMany).not.toHaveBeenCalled();
  });

  test("OAuth users receive all accepted memberships with the current workspace first", async () => {
    const otherWorkspace = {
      id: "org_other",
      slug: "other",
      name: "Other workspace",
      logo: "https://example.com/logo.png",
    };
    const db = createDb([
      { role: "member", organizations: otherWorkspace },
      { role: "admin", organizations: currentWorkspace },
    ]);
    const auth: AuthData = {
      type: "oauth",
      keyId: "oauth:user_test:org_current",
      userId: "user_test",
      scopes: ["posts.read"],
      identity: { externalId: currentWorkspace.id },
    };

    const response = await getWorkspaceContext(db, auth, currentWorkspace.id);

    expect(response).toEqual({
      currentWorkspace,
      workspaces: [
        {
          ...currentWorkspace,
          role: "admin",
          status: "active",
          isCurrent: true,
        },
        {
          ...otherWorkspace,
          role: "member",
          status: "active",
          isCurrent: false,
        },
      ],
      authentication: {
        type: "oauth",
        accountId: "user_test",
        scopes: ["posts.read"],
      },
    });
    expect(
      getWorkspacesResponseSchema.safeParse({
        ...response,
        pagination: { nextCursor: null },
      }).success
    ).toBe(true);
  });

  test("keeps the token workspace visible while membership sync catches up", async () => {
    const db = createDb([]);
    const auth: AuthData = {
      type: "oauth",
      keyId: "oauth:user_test:org_current",
      userId: "user_test",
      scopes: [],
      identity: { externalId: currentWorkspace.id },
    };

    const response = await getWorkspaceContext(db, auth, currentWorkspace.id);

    expect(response?.workspaces).toEqual([
      {
        ...currentWorkspace,
        role: null,
        status: "active",
        isCurrent: true,
      },
    ]);
  });

  test("adds only safe pending workspace details for OAuth users", async () => {
    const pendingWorkspace = {
      id: "org_pending",
      slug: "pending",
      name: "Pending workspace",
      logo: null,
      workosOrgId: "workos_org_pending",
    };
    const unrelatedWorkspace = {
      id: "org_unrelated",
      slug: "unrelated",
      name: "Unrelated workspace",
      logo: null,
      workosOrgId: "workos_org_unrelated",
    };
    const db = createDb(
      [{ role: "admin", organizations: currentWorkspace }],
      [pendingWorkspace, unrelatedWorkspace]
    );
    const auth: AuthData = {
      type: "oauth",
      keyId: "oauth:user_test:org_current",
      userId: "user_test",
      scopes: [],
      identity: { externalId: currentWorkspace.id },
    };
    const loadPendingInvitations = mock(async (email: string) => {
      expect(email).toBe("member@example.com");
      return [
        {
          organizationId: "workos_org_pending",
          role: "member",
          token: "must-not-leak",
          acceptInvitationUrl: "https://must-not-leak.example",
        },
      ];
    });

    const response = await getWorkspaceContext(
      db,
      auth,
      currentWorkspace.id,
      loadPendingInvitations
    );

    expect(response?.workspaces).toEqual([
      {
        ...currentWorkspace,
        role: "admin",
        status: "active",
        isCurrent: true,
      },
      {
        id: pendingWorkspace.id,
        slug: pendingWorkspace.slug,
        name: pendingWorkspace.name,
        logo: pendingWorkspace.logo,
        role: "member",
        status: "pending",
        isCurrent: false,
      },
    ]);
    expect(JSON.stringify(response)).not.toMatch(
      /must-not-leak|acceptInvitationUrl|member@example.com|workos_org_pending/
    );
  });

  test("is reachable for every valid bearer token without a resource scope", () => {
    expect(isUnscopedApiPath("/v1/me/workspaces")).toBe(true);
    expect(getApiAuthRequirements("/v1/me/workspaces", "GET")).toEqual({
      legacyPermissions: [],
    });
    expect(getApiAuthRequirements("/v1/not-a-route", "GET")).toBeNull();
  });

  test("serves the workspace contract through the HTTP route", async () => {
    const auth = {
      keyId: "key_test",
      identity: { externalId: currentWorkspace.id },
    } as AuthData;

    const response = await createWorkspaceApp(auth).request("/me/workspaces");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      currentWorkspace,
      workspaces: [
        {
          ...currentWorkspace,
          role: null,
          status: "active",
          isCurrent: true,
        },
      ],
      authentication: { type: "apiKey" },
      pagination: { nextCursor: null },
    });
  });

  test("paginates workspaces with a stable resource cursor", () => {
    const workspaces = [
      {
        ...currentWorkspace,
        role: "admin",
        status: "active" as const,
        isCurrent: true,
      },
      {
        id: "org_second",
        slug: "second",
        name: "Second",
        logo: null,
        role: "member",
        status: "active" as const,
        isCurrent: false,
      },
    ];

    expect(paginateWorkspaces(workspaces, 1)).toEqual({
      workspaces: [workspaces[0]],
      pagination: { nextCursor: currentWorkspace.id },
    });
    expect(paginateWorkspaces(workspaces, 1, currentWorkspace.id)).toEqual({
      workspaces: [workspaces[1]],
      pagination: { nextCursor: null },
    });
    expect(paginateWorkspaces(workspaces, 1, "org_unknown")).toBeNull();
  });

  test("rejects public ingest tokens", async () => {
    const response = await createWorkspaceApp({
      type: "ingest",
      keyId: "feedback:org_current:-",
      scopes: ["feedback.write"],
      projectId: null,
      identity: { externalId: currentWorkspace.id },
    }).request("/me/workspaces");

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Forbidden: ingest tokens cannot access workspace discovery",
    });
  });

  test("fails closed when OAuth invitation discovery is unavailable", async () => {
    const response = await createWorkspaceApp({
      type: "oauth",
      keyId: "oauth:user_test:org_current",
      userId: "user_test",
      scopes: [],
      identity: { externalId: currentWorkspace.id },
    }).request("/me/workspaces");

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Authentication service unavailable",
    });
  });
});
