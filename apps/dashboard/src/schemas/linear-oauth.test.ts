import { describe, expect, test } from "bun:test";

import {
  linearOAuthStateSchema,
  linearOrganizationQuerySchema,
} from "@/schemas/linear-oauth";

const state = {
  organizationId: "org_1",
  userId: "user_1",
  callbackPath: "/integrations",
};

describe("linearOAuthStateSchema", () => {
  test("accepts stored state as an object or a JSON string", () => {
    expect(linearOAuthStateSchema.parse(state)).toEqual(state);
    expect(linearOAuthStateSchema.parse(JSON.stringify(state))).toEqual(state);
  });

  test("rejects malformed or incomplete state without throwing", () => {
    expect(linearOAuthStateSchema.safeParse("{not json").success).toBe(false);
    expect(
      linearOAuthStateSchema.safeParse({ ...state, userId: "" }).success
    ).toBe(false);
  });
});

describe("linearOrganizationQuerySchema", () => {
  test("accepts an organization payload", () => {
    const parsed = linearOrganizationQuerySchema.parse({
      data: { organization: { id: "lin_1", name: "Acme" } },
    });
    expect(parsed.data.organization).toEqual({ id: "lin_1", name: "Acme" });
  });

  test("rejects GraphQL errors with null data", () => {
    expect(
      linearOrganizationQuerySchema.safeParse({
        data: null,
        errors: [{ message: "Unauthorized" }],
      }).success
    ).toBe(false);
  });
});
