import { afterAll, beforeEach, expect, mock, test } from "bun:test";

import { members, organizations, users } from "@notra/db/schema";
import { NotFoundException, type User } from "@workos-inc/node";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import { createAutopilotSandbox } from "../utils/autopilot-sandbox";

const { db, postgres } = await createAutopilotSandbox();
afterAll(() => postgres.close());

const events: string[] = [];
const markers = new Map<string, string>();
let redisFails = false;
let workosUserState: "exists" | "missing" | "stop" = "exists";
let workosDeleteFails = false;

const redis = {
  set: async (key: string, value: string) => {
    if (redisFails) {
      throw new Error("Synthetic Redis outage");
    }
    events.push(`marker:${key}`);
    markers.set(key, value);
  },
  get: async (key: string) => {
    if (redisFails) {
      throw new Error("Synthetic Redis outage");
    }
    return markers.get(key) ?? null;
  },
  del: async (key: string) => {
    events.push(`clear:${key}`);
    markers.delete(key);
  },
};
const notFound = () =>
  new NotFoundException({ path: "/users", requestID: "synthetic" });
const workos = {
  userManagement: {
    listSessions: async (workosUserId: string) => ({
      autoPagination: async () => [
        { id: `${workosUserId}-session-a` },
        { id: `${workosUserId}-session-b` },
      ],
    }),
    revokeSession: async ({ sessionId }: { sessionId: string }) => {
      events.push(`revoke:${sessionId}`);
    },
    deleteUser: async (workosUserId: string) => {
      events.push(`workos:${workosUserId}`);
      if (workosDeleteFails) {
        throw new Error("Synthetic WorkOS failure");
      }
    },
    getUser: async (workosUserId: string) => {
      events.push(`verify:${workosUserId}`);
      if (workosUserState === "missing") {
        throw notFound();
      }
      if (workosUserState === "stop") {
        throw new Error("Synthetic stop after the deletion check");
      }
      return { id: workosUserId };
    },
  },
};
const deleteUserRows = mock(async (userId: string) => {
  events.push(`local:${userId}`);
  return [`organization/workspace/chat/${userId}.png`];
});
const deleteDeletedUserFiles = mock(async (userId: string, keys: string[]) => {
  events.push(`files:${userId}:${keys.join(",")}`);
});
let ownerKept = false;
const deleteUserRecord = mock(
  async (userId: string, _options?: { keepWorkspaceOwners?: boolean }) => {
    events.push(`record:${userId}`);
    return !ownerKept;
  }
);
const finishUserDeletion = mock(
  ({ userId, email }: { userId: string; email: string }) => {
    events.push(`finish:${userId}:${email}`);
  }
);

mock.module("@notra/db/drizzle", () => ({ db }));
mock.module("@notra/ai/utils/redis", () => ({ redis }));
mock.module("@workos/authkit-session", () => ({ getWorkOS: () => workos }));
mock.module("@/lib/auth/finish-user-deletion", () => ({
  finishUserDeletion,
}));
mock.module("@/lib/auth/delete-user-record", () => ({
  deleteDeletedUserFiles,
  deleteUserRecord,
  deleteUserRows,
}));

const { deleteAccount } = await import("../../src/lib/auth/delete-account");
const { ensureLocalUser } = await import("../../src/lib/auth/sync");
const { deleteUserFromWebhook } =
  await import("../../src/lib/auth/webhook-sync");

const marker = "account-deletion:workos-user";
const workosUser = {
  id: "workos-user",
  email: "deleted@example.test",
  emailVerified: true,
  firstName: "Deleted",
  lastName: "User",
  profilePictureUrl: null,
} as unknown as User;

beforeEach(async () => {
  await postgres.exec("TRUNCATE organizations, users CASCADE;");
  events.length = 0;
  markers.clear();
  redisFails = false;
  workosUserState = "exists";
  workosDeleteFails = false;
  ownerKept = false;
  deleteUserRows.mockClear();
  deleteDeletedUserFiles.mockClear();
  deleteUserRecord.mockClear();
  finishUserDeletion.mockClear();
});

const deleteSyntheticAccount = () =>
  Effect.runPromise(
    deleteAccount({
      userId: "local-user",
      email: "deleted@example.test",
      workosUserId: "workos-user",
    })
  );

test("deletes in order: marker, sessions, local rows, WorkOS user, files", async () => {
  await deleteSyntheticAccount();
  expect(events).toEqual([
    `marker:${marker}`,
    "revoke:workos-user-session-a",
    "revoke:workos-user-session-b",
    "local:local-user",
    "finish:local-user:deleted@example.test",
    "workos:workos-user",
    "files:local-user:organization/workspace/chat/local-user.png",
  ]);
  expect(markers.has(marker)).toBe(true);
});

test("a failed WorkOS deletion clears the marker and still removes the files", async () => {
  workosDeleteFails = true;
  await expect(deleteSyntheticAccount()).rejects.toThrow(
    "Failed to delete WorkOS user"
  );
  expect(events.slice(-3)).toEqual([
    "workos:workos-user",
    `clear:${marker}`,
    "files:local-user:organization/workspace/chat/local-user.png",
  ]);
  expect(markers.has(marker)).toBe(false);
});

test("runs without a marker when Redis isn't configured", async () => {
  // Updates the already imported module in place.
  mock.module("@notra/ai/utils/redis", () => ({ redis: null }));
  try {
    await deleteSyntheticAccount();
  } finally {
    mock.module("@notra/ai/utils/redis", () => ({ redis }));
  }
  expect(events).toEqual([
    "revoke:workos-user-session-a",
    "revoke:workos-user-session-b",
    "local:local-user",
    "finish:local-user:deleted@example.test",
    "workos:workos-user",
    "files:local-user:organization/workspace/chat/local-user.png",
  ]);
});

test("does not start when Redis is configured but the marker can't be set", async () => {
  redisFails = true;
  await expect(deleteSyntheticAccount()).rejects.toThrow(
    "Account deletion is unavailable right now"
  );
  expect(events).toEqual([]);
  expect(deleteUserRows).not.toHaveBeenCalled();
});

test("ensureLocalUser doesn't recreate an account that is being deleted", async () => {
  markers.set(marker, "1");
  await expect(Effect.runPromise(ensureLocalUser(workosUser))).rejects.toThrow(
    "This account is being deleted"
  );
  expect(await db.select().from(users)).toEqual([]);
  expect(events).not.toContain("verify:workos-user");
});

test("ensureLocalUser goes on to sign-up while Redis can't answer", async () => {
  redisFails = true;
  workosUserState = "stop";
  await expect(Effect.runPromise(ensureLocalUser(workosUser))).rejects.toThrow(
    "Failed to verify WorkOS user"
  );
  expect(events).toContain("verify:workos-user");
});

test("ensureLocalUser goes on to sign-up without a marker", async () => {
  workosUserState = "stop";
  await expect(Effect.runPromise(ensureLocalUser(workosUser))).rejects.toThrow(
    "Failed to verify WorkOS user"
  );
  expect(events).toContain("verify:workos-user");
});

async function seedLocalUser(role?: string) {
  await db.insert(users).values({
    id: "local-user",
    name: "Deleted User",
    email: "deleted@example.test",
    workosUserId: "workos-user",
  });
  if (role) {
    await db.insert(organizations).values({
      id: "workspace",
      name: "Workspace",
      slug: "workspace",
      createdAt: new Date(),
    });
    await db.insert(members).values({
      id: "membership",
      organizationId: "workspace",
      userId: "local-user",
      role,
      createdAt: new Date(),
    });
  }
}

test("user.deleted webhook deletes a local account WorkOS no longer has", async () => {
  await seedLocalUser("member");
  workosUserState = "missing";
  await Effect.runPromise(deleteUserFromWebhook(workosUser));
  expect(deleteUserRecord.mock.calls).toEqual([
    ["local-user", { keepWorkspaceOwners: true }],
  ]);
  expect(events.slice(-2)).toEqual([
    "record:local-user",
    "finish:local-user:deleted@example.test",
  ]);
});

test("user.deleted webhook keeps the account while WorkOS still has the user", async () => {
  await seedLocalUser();
  await Effect.runPromise(deleteUserFromWebhook(workosUser));
  expect(deleteUserRecord).not.toHaveBeenCalled();
});

test("user.deleted webhook keeps a user the deletion found owning a workspace", async () => {
  await seedLocalUser("owner");
  workosUserState = "missing";
  ownerKept = true;
  await Effect.runPromise(deleteUserFromWebhook(workosUser));
  expect(deleteUserRecord.mock.calls).toEqual([
    ["local-user", { keepWorkspaceOwners: true }],
  ]);
  expect(finishUserDeletion).not.toHaveBeenCalled();
});
