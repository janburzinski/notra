import { expect, mock, test } from "bun:test";

const revokeUserPreviewAccess = mock(async (_userId: string) => {});

mock.module("@notra/sites-server/env", () => ({
  isSitesConfigured: () => false,
}));
mock.module("@notra/sites-server/preview-revocation", () => ({
  revokeOrganizationMemberPreviewAccess: async () => {},
  revokeUserPreviewAccess,
  revokeUserPreviewSessions: async () => {},
}));

const { revokeSitePreviewAccessForAccountDeletion } =
  await import("../src/lib/sites/preview-revocation");

test("account deletion revokes links even without Sites builder configuration", async () => {
  await revokeSitePreviewAccessForAccountDeletion("user-1");
  expect(revokeUserPreviewAccess).toHaveBeenCalledWith("user-1");
});
