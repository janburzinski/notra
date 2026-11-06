import { expect, mock, test } from "bun:test";

mock.module("./autumn", () => ({
  autumn: null,
  allowUnmeteredAiInDevelopment: false,
}));
mock.module("./token-pricing", () => ({
  shouldApplyMarkup: () => false,
}));

const { checkChatBilling } = await import("./chat-billing");

test("fails closed when billing is absent outside the development bypass", async () => {
  await expect(checkChatBilling("dummy-organization")).rejects.toThrow(
    "Autumn billing is not configured"
  );
});
