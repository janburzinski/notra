import { afterAll, beforeEach, expect, mock, spyOn, test } from "bun:test";

import * as schema from "@notra/db/schema";
import {
  autopilotNamespaceDeletions,
  chatAttachments,
  chatSessions,
  members,
  organizations,
  users,
} from "@notra/db/schema";
import { setMemoryStore } from "@notra/memory/memory";
import { createInMemoryStore } from "@notra/memory/stores/in-memory";
import { call, os } from "@orpc/server";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { Effect } from "effect";

import { AUTOPILOT_NAMESPACE_CLEANUP_BUDGET_MS } from "../../src/constants/autopilot";
import { createORPCContext } from "../../src/lib/orpc/context";
import type { ORPCContext } from "../../src/types/orpc/context";
import { owner } from "../constants/user-organization-teardown";
import { createAutopilotSandbox } from "../utils/autopilot-sandbox";

const { db, postgres } = await createAutopilotSandbox();
afterAll(() => postgres.close());
const memory = new Set<string>();
const workosEvents: string[] = [];
let failTeardown = false;
let failMemoryCleanup = false;
let failWorkos = false;
let stalledRequest = 0;
let expireCleanupBudget = () => {};
let abortedRequests = 0;
let activeRequests = 0;
const deletedChatAttachmentObjects: string[][] = [];
const deleteUserChatAttachmentObjects = mock(
  async (userId: string, keys: string[]) => {
    // Objects go only once the rows are committed away, never before.
    expect(
      await db.query.users.findFirst({ where: eq(users.id, userId) })
    ).toBeUndefined();
    deletedChatAttachmentObjects.push(keys);
    return keys.length;
  }
);
const deleteUserFiles = mock(async (userId: string) => {
  expect(
    await db.query.users.findFirst({ where: eq(users.id, userId) })
  ).toBeUndefined();
  return 0;
});
const teardown = mock(async () => {
  if (failTeardown) {
    throw new Error("Synthetic teardown failure");
  }
});
const deleteNamespace = mock(
  async (organizationId: string, signal?: AbortSignal) => {
    if (
      stalledRequest > 0 &&
      deleteNamespace.mock.calls.length === stalledRequest
    ) {
      if (!signal) {
        throw new Error("Cleanup must provide a deadline signal");
      }
      activeRequests += 1;
      const stalled = new Promise<void>((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            abortedRequests += 1;
            activeRequests -= 1;
            reject(signal.reason);
          },
          { once: true }
        );
      });
      expireCleanupBudget();
      return stalled;
    }
    if (failMemoryCleanup) {
      throw new Error("Synthetic memory cleanup failure");
    }
    memory.delete(organizationId);
  }
);
setMemoryStore({ ...createInMemoryStore(), deleteRepo: deleteNamespace });
afterAll(() => setMemoryStore(null));

// The app's queries are logged so tests can check statement order.
const queryLog: { query: string; params: unknown[] }[] = [];
const loggedDb = drizzle(postgres, {
  schema,
  logger: { logQuery: (query, params) => queryLog.push({ query, params }) },
});
mock.module("@notra/db/drizzle", () => ({ db: loggedDb }));
mock.module("@notra/sites-server/organization", () => ({
  deleteOrganizationSites: teardown,
}));
mock.module("@notra/ai/utils/server-log", () => ({ logError: mock() }));
mock.module("@/lib/orpc/base", () => ({
  authorizedProcedure: os
    .$context<Pick<ORPCContext, "headers">>()
    .use(({ next }) => next({ context: { user: { id: "synthetic-user" } } })),
}));
mock.module("@/lib/i18n/server", () => ({
  getTranslations: async () => (key: string) => key,
}));
mock.module("@/lib/organizations/workos-sync", () => ({
  deleteOrganizationFromWorkOS: () =>
    failWorkos
      ? Effect.fail(new Error("Synthetic WorkOS failure"))
      : Effect.void,
  removeMembershipFromWorkOS: () => {
    workosEvents.push("remove");
    return Effect.void;
  },
  updateMembershipRoleInWorkOS: () => {
    workosEvents.push("promote");
    return Effect.void;
  },
}));
mock.module("@/lib/billing/delete-autumn-customer", () => ({
  deleteAutumnCustomer: async () => {},
}));
mock.module("@/lib/sites/preview-revocation", () => ({
  revokeSitePreviewAccess: async () => {},
}));
mock.module("@/lib/upload/cleanup", () => ({
  deleteOrganizationChatFiles: async () => {},
  deleteOrganizationFiles: async () => {},
  deleteUserChatAttachmentObjects,
  deleteUserFiles,
}));
mock.module("../../src/lib/orpc/routers/user-account", () => ({
  userAccountRouter: {},
  userSecurityRouter: {},
}));
const runDueAutopilots = mock(async () => {
  expect(activeRequests).toBe(0);
  return { checked: 0, started: 0, failed: 0 };
});
mock.module("@/lib/autopilot/schedule", () => ({ runDueAutopilots }));

const { userRouter } = await import("../../src/lib/orpc/routers/user");
const { cleanupAutopilotNamespaces } =
  await import("../../src/lib/autopilot/namespace-deletions");
const { GET } = await import("../../src/app/api/cron/autopilot/route");
const { deleteUserRecord } =
  await import("../../src/lib/auth/delete-user-record");
const context = await createORPCContext({ headers: new Headers() });

await postgres.exec(
  `CREATE FUNCTION fail_deletion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic DB failure'; END $$`
);
beforeEach(async () => {
  await postgres.exec(`DROP TRIGGER IF EXISTS fail_cascade ON organizations;
    DROP TRIGGER IF EXISTS fail_user_delete ON users;
    DROP TRIGGER IF EXISTS fail_ack ON autopilot_namespace_deletions;
    TRUNCATE organizations, users, autopilot_namespace_deletions CASCADE;`);
  await db.insert(users).values([
    {
      id: "synthetic-user",
      name: "Synthetic User",
      email: "synthetic@example.test",
    },
    { id: "next-owner", name: "Next Owner", email: "next@example.test" },
  ]);
  await db.insert(organizations).values(
    ["workspace", "other"].map((id) => ({
      id,
      name: id,
      slug: id,
      createdAt: new Date(),
    }))
  );
  await db.insert(members).values([
    {
      ...owner,
      organizationId: "workspace",
      userId: "synthetic-user",
      createdAt: new Date(),
    },
    {
      id: "other-membership",
      organizationId: "other",
      userId: "synthetic-user",
      role: "owner",
      createdAt: new Date(),
    },
  ]);
  memory.clear();
  memory.add("workspace");
  memory.add("other");
  workosEvents.length = 0;
  teardown.mockClear();
  deleteNamespace.mockClear();
  failTeardown = false;
  failMemoryCleanup = false;
  failWorkos = false;
  stalledRequest = 0;
  abortedRequests = 0;
  activeRequests = 0;
  runDueAutopilots.mockClear();
  deleteUserChatAttachmentObjects.mockClear();
  deleteUserFiles.mockClear();
  queryLog.length = 0;
  deletedChatAttachmentObjects.length = 0;
});

async function deleteWorkspace(route: string) {
  return route === "normal"
    ? await call(
        userRouter.membership.applyAction,
        { organizationId: "workspace", action: "delete" },
        { context }
      )
    : await call(
        userRouter.deleteWithTransfers,
        { transfers: [{ orgId: "workspace", action: "delete" }] },
        { context }
      );
}

test.each(["normal", "transfers"])(
  "%s rejects nonmembers and nonowners without touching memory",
  async (route) => {
    await db
      .update(members)
      .set({ role: "admin" })
      .where(eq(members.id, owner.id));
    await expect(deleteWorkspace(route)).rejects.toThrow();
    await db.delete(members).where(eq(members.id, owner.id));
    await expect(deleteWorkspace(route)).rejects.toThrow();
    expect(teardown).not.toHaveBeenCalled();
    expect(deleteNamespace).not.toHaveBeenCalled();
    expect(await db.select().from(autopilotNamespaceDeletions)).toEqual([]);
  }
);

test("normal deletion preserves the last workspace", async () => {
  await db.delete(members).where(eq(members.organizationId, "other"));
  await expect(deleteWorkspace("normal")).rejects.toThrow();
  expect(teardown).not.toHaveBeenCalled();
});

test.each(["normal", "transfers"])(
  "%s site and DB failures preserve active workspace memory with no cleanup queued",
  async (route) => {
    failTeardown = true;
    await expect(deleteWorkspace(route)).rejects.toThrow(
      "Synthetic teardown failure"
    );
    failTeardown = false;
    await postgres.exec(
      "CREATE TRIGGER fail_cascade BEFORE DELETE ON organizations FOR EACH ROW EXECUTE FUNCTION fail_deletion()"
    );
    await expect(deleteWorkspace(route)).rejects.toThrow();
    expect(
      await db.query.organizations.findFirst({
        where: eq(organizations.id, "workspace"),
      })
    ).toBeDefined();
    expect(await db.select().from(autopilotNamespaceDeletions)).toEqual([]);
    expect(await cleanupAutopilotNamespaces()).toEqual({
      checked: 0,
      failed: 0,
    });
    expect(memory.has("workspace")).toBe(true);
    expect(deleteNamespace).not.toHaveBeenCalled();
    await postgres.exec("DROP TRIGGER fail_cascade ON organizations");
    await deleteWorkspace(route);
    await cleanupAutopilotNamespaces();
    expect(memory.has("workspace")).toBe(false);
  }
);

test.each(["normal", "transfers"])(
  "%s commits deletion and retries remote failures independently of user membership",
  async (route) => {
    await deleteWorkspace(route);
    expect(
      await db.query.organizations.findFirst({
        where: eq(organizations.id, "workspace"),
      })
    ).toBeUndefined();
    expect(deleteNamespace).not.toHaveBeenCalled();
    expect(memory.has("workspace")).toBe(true);
    expect(await db.select().from(autopilotNamespaceDeletions)).toHaveLength(1);
    await expect(deleteWorkspace(route)).rejects.toThrow();
    await db.delete(users).where(eq(users.id, "synthetic-user"));
    failMemoryCleanup = true;
    const now = new Date();
    expect(await cleanupAutopilotNamespaces(now)).toEqual({
      checked: 1,
      failed: 1,
    });
    expect(await db.select().from(autopilotNamespaceDeletions)).toHaveLength(1);
    expect(await cleanupAutopilotNamespaces(now)).toEqual({
      checked: 0,
      failed: 0,
    });
    failMemoryCleanup = false;
    expect(
      await cleanupAutopilotNamespaces(new Date(now.getTime() + 300_001))
    ).toEqual({ checked: 1, failed: 0 });
    expect(memory.has("workspace")).toBe(false);
    expect(memory.has("other")).toBe(true);
    expect(await db.select().from(autopilotNamespaceDeletions)).toEqual([]);
    expect(await cleanupAutopilotNamespaces()).toEqual({
      checked: 0,
      failed: 0,
    });
  }
);

test.each(["normal", "transfers"])(
  "%s retries safely after remote success but failed DB acknowledgement",
  async (route) => {
    await deleteWorkspace(route);
    await postgres.exec(
      "CREATE TRIGGER fail_ack BEFORE DELETE ON autopilot_namespace_deletions FOR EACH ROW EXECUTE FUNCTION fail_deletion()"
    );
    expect(await cleanupAutopilotNamespaces()).toEqual({
      checked: 1,
      failed: 1,
    });
    expect(memory.has("workspace")).toBe(false);
    expect(await db.select().from(autopilotNamespaceDeletions)).toHaveLength(1);
    await postgres.exec(
      "DROP TRIGGER fail_ack ON autopilot_namespace_deletions"
    );
    expect(await cleanupAutopilotNamespaces()).toEqual({
      checked: 1,
      failed: 0,
    });
    expect(deleteNamespace).toHaveBeenCalledTimes(2);
  }
);

test.each(["normal", "transfers"])(
  "%s retains cleanup if later WorkOS processing fails",
  async (route) => {
    failWorkos = true;
    await expect(deleteWorkspace(route)).rejects.toThrow();
    expect(await db.select().from(autopilotNamespaceDeletions)).toHaveLength(1);
    await cleanupAutopilotNamespaces();
    expect(memory.has("workspace")).toBe(false);
  }
);

test("account deletion preserves transferred workspace memory and ownership synchronization", async () => {
  await db.insert(members).values({
    id: "next-membership",
    organizationId: "workspace",
    userId: "next-owner",
    role: "admin",
    createdAt: new Date(),
  });
  await call(
    userRouter.deleteWithTransfers,
    {
      transfers: [
        { orgId: "workspace", action: "transfer" },
        { orgId: "other", action: "delete" },
      ],
    },
    { context }
  );
  expect(
    (
      await db.query.members.findFirst({
        where: eq(members.id, "next-membership"),
      })
    )?.role
  ).toBe("owner");
  expect(workosEvents).toEqual(["promote", "remove"]);
  await cleanupAutopilotNamespaces();
  expect(memory.has("workspace")).toBe(true);
  expect(memory.has("other")).toBe(false);
});

function chatAttachment(id: string, organizationId: string, userId: string) {
  return {
    id,
    organizationId,
    userId,
    key: `organization/${organizationId}/chat/${id}.png`,
    filename: `${id}.png`,
    mediaType: "image/png",
    size: 1,
  };
}

test("account deletion removes the user's chat attachments from a transferred workspace", async () => {
  await db.insert(members).values({
    id: "next-membership",
    organizationId: "workspace",
    userId: "next-owner",
    role: "admin",
    createdAt: new Date(),
  });
  await db
    .insert(chatAttachments)
    .values([
      chatAttachment("mine", "workspace", "synthetic-user"),
      chatAttachment("theirs", "workspace", "next-owner"),
    ]);
  await call(
    userRouter.deleteWithTransfers,
    { transfers: [{ orgId: "workspace", action: "transfer" }] },
    { context }
  );
  // The transferred workspace keeps the attachment until the account goes.
  expect(await db.select().from(chatAttachments)).toHaveLength(2);
  expect(deleteUserFiles).not.toHaveBeenCalled();

  await postgres.exec(
    "CREATE TRIGGER fail_user_delete BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION fail_deletion()"
  );
  await expect(deleteUserRecord("synthetic-user")).rejects.toThrow();
  expect(deleteUserChatAttachmentObjects).not.toHaveBeenCalled();
  expect(deleteUserFiles).not.toHaveBeenCalled();
  expect(await db.select().from(chatAttachments)).toHaveLength(2);
  await postgres.exec("DROP TRIGGER fail_user_delete ON users");

  await deleteUserRecord("synthetic-user");
  expect(deletedChatAttachmentObjects).toEqual([
    ["organization/workspace/chat/mine.png"],
  ]);
  expect(
    (await db.select().from(chatAttachments)).map((row) => row.id)
  ).toEqual(["theirs"]);
  expect(deleteUserFiles).toHaveBeenCalledWith("synthetic-user");
});

test("account deletion removes user files without an owned workspace", async () => {
  await db.insert(members).values({
    id: "next-membership",
    organizationId: "workspace",
    userId: "next-owner",
    role: "member",
    createdAt: new Date(),
  });
  await deleteUserRecord("next-owner");
  expect(deleteUserFiles.mock.calls).toEqual([["next-owner"]]);
  expect(deleteUserChatAttachmentObjects).toHaveBeenCalledWith(
    "next-owner",
    []
  );
});

function fileMessage(id: string, file: string, authorUserId?: string) {
  return {
    id,
    role: "user",
    parts: [
      {
        type: "file",
        url: `https://files.example.test/organization/workspace/chat/${file}.png`,
        mediaType: "image/png",
      },
    ],
    ...(authorUserId ? { metadata: { authorUserId } } : {}),
  };
}

async function seedSharedChat(messages: ReturnType<typeof fileMessage>[][]) {
  await db.insert(users).values([
    { id: "third-member", name: "Third", email: "third@example.test" },
    { id: "former-member", name: "Former", email: "former@example.test" },
  ]);
  await db.insert(members).values(
    ["next-owner", "third-member"].map((userId) => ({
      id: `${userId}-membership`,
      organizationId: "workspace",
      userId,
      role: "member",
      createdAt: new Date(),
    }))
  );
  await db
    .insert(chatAttachments)
    .values([chatAttachment("mine", "workspace", "synthetic-user")]);
  await db.insert(chatSessions).values(
    messages.map((sessionMessages, index) => ({
      id: `chat-${index}`,
      organizationId: "workspace",
      title: "Shared chat",
      messages: sessionMessages,
      createdAt: new Date(Date.UTC(2026, 0, index + 1)),
    }))
  );
}

test("account deletion hands a file another member sent to the earliest such member", async () => {
  await seedSharedChat([
    [
      fileMessage("own", "mine", "synthetic-user"),
      fileMessage("third", "mine", "third-member"),
    ],
    [fileMessage("next", "mine", "next-owner")],
  ]);
  await deleteUserRecord("synthetic-user");
  expect(deletedChatAttachmentObjects).toEqual([[]]);
  expect(
    (await db.select().from(chatAttachments)).map((row) => [
      row.key,
      row.userId,
    ])
  ).toEqual([["organization/workspace/chat/mine.png", "third-member"]]);
});

test("account deletion removes a file only unattributable messages or former members used", async () => {
  await seedSharedChat([
    [
      fileMessage("anonymous", "mine"),
      fileMessage("former", "mine", "former-member"),
      fileMessage("other-file", "other", "next-owner"),
    ],
  ]);
  await deleteUserRecord("synthetic-user");
  expect(deletedChatAttachmentObjects).toEqual([
    ["organization/workspace/chat/mine.png"],
  ]);
  expect(await db.select().from(chatAttachments)).toEqual([]);
});

test("account deletion keeps a file that was uploaded again after the commit", async () => {
  await db
    .insert(chatAttachments)
    .values([chatAttachment("mine", "workspace", "synthetic-user")]);
  // Fires after the cascade (constraint triggers sort first), like a re-upload
  // recorded between the commit and the R2 delete.
  await postgres.exec(`
    CREATE FUNCTION reupload() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      INSERT INTO chat_attachments (id, organization_id, user_id, key, filename, media_type, size)
      VALUES ('again', 'workspace', 'next-owner', 'organization/workspace/chat/mine.png', 'mine.png', 'image/png', 1);
      RETURN OLD;
    END $$;
    CREATE TRIGGER zz_reupload AFTER DELETE ON users FOR EACH ROW EXECUTE FUNCTION reupload();`);
  try {
    await deleteUserRecord("synthetic-user");
  } finally {
    await postgres.exec(
      "DROP TRIGGER zz_reupload ON users; DROP FUNCTION reupload();"
    );
  }
  expect(deletedChatAttachmentObjects).toEqual([[]]);
  expect(
    (await db.select().from(chatAttachments)).map((row) => row.id)
  ).toEqual(["again"]);
});

async function withSyntheticDeadlocks(
  times: number,
  run: () => Promise<unknown>
) {
  await postgres.exec(`
    CREATE SEQUENCE delete_attempts;
    CREATE FUNCTION deadlock_user_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF nextval('delete_attempts') <= ${times} THEN
        RAISE EXCEPTION 'Synthetic deadlock' USING ERRCODE = '40P01';
      END IF;
      RETURN OLD;
    END $$;
    CREATE TRIGGER deadlock_user_delete BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION deadlock_user_delete();`);
  try {
    await run();
  } finally {
    await postgres.exec(`DROP TRIGGER deadlock_user_delete ON users;
      DROP FUNCTION deadlock_user_delete(); DROP SEQUENCE delete_attempts;`);
  }
}

test("account deletion retries a transaction Postgres cancelled as a deadlock", async () => {
  await db
    .insert(chatAttachments)
    .values([chatAttachment("mine", "workspace", "synthetic-user")]);
  await withSyntheticDeadlocks(2, () => deleteUserRecord("synthetic-user"));
  expect(
    await db.query.users.findFirst({ where: eq(users.id, "synthetic-user") })
  ).toBeUndefined();
  expect(deletedChatAttachmentObjects).toEqual([
    ["organization/workspace/chat/mine.png"],
  ]);
});

test("account deletion gives up after three deadlocks and keeps everything", async () => {
  await db
    .insert(chatAttachments)
    .values([chatAttachment("mine", "workspace", "synthetic-user")]);
  await withSyntheticDeadlocks(3, async () => {
    await expect(deleteUserRecord("synthetic-user")).rejects.toMatchObject({
      cause: { code: "40P01" },
    });
    const attempts = await postgres.query<{ attempts: number }>(
      "SELECT last_value::int AS attempts FROM delete_attempts"
    );
    expect(attempts.rows).toEqual([{ attempts: 3 }]);
  });
  expect(
    await db.query.users.findFirst({ where: eq(users.id, "synthetic-user") })
  ).toBeDefined();
  expect(await db.select().from(chatAttachments)).toHaveLength(1);
  expect(deleteUserChatAttachmentObjects).not.toHaveBeenCalled();
  expect(deleteUserFiles).not.toHaveBeenCalled();
});

test("account deletion locks the user and recipients in id order before the hand-over", async () => {
  await seedSharedChat([
    [
      fileMessage("third", "mine", "third-member"),
      fileMessage("next", "theirs", "next-owner"),
    ],
  ]);
  await db
    .insert(chatAttachments)
    .values([chatAttachment("theirs", "workspace", "synthetic-user")]);
  await deleteUserRecord("synthetic-user");

  const lockIndex = queryLog.findIndex(({ query }) =>
    /from "users" where "users"\."id" in .* order by "users"\."id" for update$/.test(
      query
    )
  );
  const handOverIndex = queryLog.findIndex(({ query }) =>
    /^\s*update "chat_attachments"/.test(query)
  );
  expect(lockIndex).toBeGreaterThan(-1);
  expect(queryLog[lockIndex]?.params.toSorted()).toEqual([
    "next-owner",
    "synthetic-user",
    "third-member",
  ]);
  expect(handOverIndex).toBeGreaterThan(lockIndex);
  expect(
    queryLog
      .slice(0, handOverIndex)
      .filter(({ query }) => /for update/.test(query))
  ).toHaveLength(1);
  expect(
    (await db.select().from(chatAttachments)).map((row) => [row.id, row.userId])
  ).toEqual([
    ["mine", "third-member"],
    ["theirs", "next-owner"],
  ]);
});

test("two members who sent each other's files can both delete their accounts", async () => {
  await seedSharedChat([
    [
      fileMessage("next", "mine", "next-owner"),
      fileMessage("synthetic", "theirs", "synthetic-user"),
    ],
  ]);
  await db
    .insert(chatAttachments)
    .values([chatAttachment("theirs", "workspace", "next-owner")]);
  await deleteUserRecord("synthetic-user");
  await deleteUserRecord("next-owner");
  expect(deletedChatAttachmentObjects.map((keys) => keys.toSorted())).toEqual([
    [],
    [
      "organization/workspace/chat/mine.png",
      "organization/workspace/chat/theirs.png",
    ],
  ]);
});

test("keepWorkspaceOwners rechecks ownership inside the transaction and keeps a new owner", async () => {
  await db.insert(members).values({
    id: "next-membership",
    organizationId: "workspace",
    userId: "next-owner",
    role: "member",
    createdAt: new Date(),
  });
  await db
    .insert(chatAttachments)
    .values([chatAttachment("theirs", "workspace", "next-owner")]);
  // Promotes the user after the transaction started and before the ownership
  // check, like a transfer that commits while the deletion runs.
  await postgres.exec(`
    CREATE FUNCTION promote_mid_deletion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      UPDATE members SET role = 'owner' WHERE user_id = 'next-owner';
      RETURN NULL;
    END $$;
    CREATE TRIGGER promote_mid_deletion AFTER DELETE ON abuse_actions
      FOR EACH STATEMENT EXECUTE FUNCTION promote_mid_deletion();`);
  try {
    expect(
      await deleteUserRecord("next-owner", { keepWorkspaceOwners: true })
    ).toBe(false);
  } finally {
    await postgres.exec(`DROP TRIGGER promote_mid_deletion ON abuse_actions;
      DROP FUNCTION promote_mid_deletion();`);
  }
  expect(
    await db.query.users.findFirst({ where: eq(users.id, "next-owner") })
  ).toBeDefined();
  expect(await db.select().from(chatAttachments)).toHaveLength(1);
  expect(deleteUserChatAttachmentObjects).not.toHaveBeenCalled();
  expect(deleteUserFiles).not.toHaveBeenCalled();

  expect(
    await deleteUserRecord("next-owner", { keepWorkspaceOwners: true })
  ).toBe(true);
  expect(
    await db.query.users.findFirst({ where: eq(users.id, "next-owner") })
  ).toBeUndefined();
});

test("a transfer whose new owner disappears keeps the previous owner", async () => {
  await db.insert(members).values({
    id: "next-membership",
    organizationId: "workspace",
    userId: "next-owner",
    role: "admin",
    createdAt: new Date(),
  });
  // Skips the promotion, like a concurrent deletion of the new owner.
  await postgres.exec(`
    CREATE FUNCTION skip_promotion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      RETURN NULL;
    END $$;
    CREATE TRIGGER skip_promotion BEFORE UPDATE ON members FOR EACH ROW
      WHEN (NEW.role = 'owner') EXECUTE FUNCTION skip_promotion();`);
  try {
    await expect(
      call(
        userRouter.deleteWithTransfers,
        { transfers: [{ orgId: "workspace", action: "transfer" }] },
        { context }
      )
    ).rejects.toThrow("noTransferTarget");
  } finally {
    await postgres.exec(`DROP TRIGGER skip_promotion ON members;
      DROP FUNCTION skip_promotion();`);
  }
  expect(
    (await db.query.members.findFirst({ where: eq(members.id, owner.id) }))
      ?.role
  ).toBe("owner");
});

test("account deletion retains earlier cleanup if a later organization action fails", async () => {
  await expect(
    call(
      userRouter.deleteWithTransfers,
      {
        transfers: [
          { orgId: "workspace", action: "delete" },
          { orgId: "missing", action: "transfer" },
        ],
      },
      { context }
    )
  ).rejects.toThrow("notOwner");
  expect(await db.select().from(autopilotNamespaceDeletions)).toHaveLength(1);
  await cleanupAutopilotNamespaces();
  expect(memory.has("workspace")).toBe(false);
  expect(memory.has("other")).toBe(true);
});

test("authenticated cron retries the outbox even without any active Autopilots", async () => {
  process.env.CRON_SECRET = "synthetic-cron-secret";
  await deleteWorkspace("normal");
  expect(
    (await GET(new Request("https://example.test/api/cron/autopilot"))).status
  ).toBe(401);
  expect(deleteNamespace).not.toHaveBeenCalled();
  const response = await GET(
    new Request("https://example.test/api/cron/autopilot", {
      headers: { authorization: "Bearer synthetic-cron-secret" },
    })
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    cleanup: { checked: 1, failed: 0 },
  });
  expect(memory.has("workspace")).toBe(false);
});

test("cron reports remote cleanup failure and retries on the next due sweep", async () => {
  process.env.CRON_SECRET = "synthetic-cron-secret";
  await deleteWorkspace("normal");
  failMemoryCleanup = true;
  const request = () =>
    new Request("https://example.test/api/cron/autopilot", {
      headers: { authorization: "Bearer synthetic-cron-secret" },
    });
  expect((await GET(request())).status).toBe(500);
  expect(memory.has("workspace")).toBe(true);
  await db
    .update(autopilotNamespaceDeletions)
    .set({ nextAttemptAt: new Date(0) });
  failMemoryCleanup = false;
  expect((await GET(request())).status).toBe(200);
  expect(memory.has("workspace")).toBe(false);
});

test("one overall cleanup deadline aborts a stalled deletion, preserves partial progress and starts daily runs", async () => {
  process.env.CRON_SECRET = "synthetic-cron-secret";
  const now = new Date();
  await db.insert(autopilotNamespaceDeletions).values(
    Array.from({ length: 5 }, (_, index) => ({
      organizationId: `deleted-${index}`,
      nextAttemptAt: new Date(now.getTime() - 5000 + index),
    }))
  );
  const deadline = new AbortController();
  const timeout = spyOn(AbortSignal, "timeout").mockReturnValue(
    deadline.signal
  );
  // Two requests succeed before the single batch deadline expires on request three.
  stalledRequest = 3;
  expireCleanupBudget = () =>
    deadline.abort(new DOMException("Synthetic deadline", "TimeoutError"));
  const request = () =>
    new Request("https://example.test/api/cron/autopilot", {
      headers: { authorization: "Bearer synthetic-cron-secret" },
    });
  try {
    expect(
      (await GET(new Request("https://example.test/api/cron/autopilot"))).status
    ).toBe(401);
    expect(timeout).not.toHaveBeenCalled();
    expect(runDueAutopilots).not.toHaveBeenCalled();
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      checked: 0,
      started: 0,
      failed: 0,
      cleanup: { checked: 5, failed: 1 },
    });
    expect(timeout).toHaveBeenCalledTimes(1);
    expect(timeout).toHaveBeenCalledWith(AUTOPILOT_NAMESPACE_CLEANUP_BUDGET_MS);
    expect(deleteNamespace).toHaveBeenCalledTimes(3);
    expect(abortedRequests).toBe(1);
    expect(activeRequests).toBe(0);
    expect(runDueAutopilots).toHaveBeenCalledTimes(1);
    const pending = await db.select().from(autopilotNamespaceDeletions);
    expect(pending.map((row) => row.organizationId).sort()).toEqual([
      "deleted-2",
      "deleted-3",
      "deleted-4",
    ]);
    expect(
      pending
        .find((row) => row.organizationId === "deleted-2")
        ?.nextAttemptAt.getTime()
    ).toBeGreaterThan(now.getTime());
    // A new transaction can claim the retained row; no background deletion survives return.
    await db
      .update(autopilotNamespaceDeletions)
      .set({ nextAttemptAt: new Date(0) });
    timeout.mockRestore();
    stalledRequest = 0;
    expect((await GET(request())).status).toBe(200);
    expect(await db.select().from(autopilotNamespaceDeletions)).toEqual([]);
    expect(deleteNamespace).toHaveBeenCalledTimes(6);
    expect(activeRequests).toBe(0);
  } finally {
    timeout.mockRestore();
  }
});
