import { logError } from "@notra/ai/utils/server-log";
import { deleteBrewContact } from "@notra/email/utils/brew";

import { runAfterResponse } from "@/lib/after-response";
import { deleteDatabuddyVisitor } from "@/lib/analytics/databuddy-visitor-deletion";
import { notifyInfoChannel } from "@/lib/slack/info-channel";

/**
 * Work outside our database once a user's local account is gone, shared by
 * account deletion and the WorkOS `user.deleted` webhook. Each erasure step
 * runs after the response; any failure, network errors and timeouts
 * included, is logged with the user ID and step so it can be redone by hand.
 */
export function finishUserDeletion({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const runStep = (step: string, task: () => Promise<unknown>) =>
    runAfterResponse(`[Delete User] ${step} failed`, async () => {
      try {
        await task();
      } catch (error) {
        logError(`[Delete User] ${step} failed`, error, { userId, step });
      }
    });

  // Also removes a contact a sync re-created while the account was deleted.
  runStep("Brew contact deletion", () => deleteBrewContact(email));
  runStep("Databuddy visitor deletion", () => deleteDatabuddyVisitor(userId));
  notifyInfoChannel({
    emoji: ":door:",
    title: "Account deleted",
    fields: { "User ID": userId },
  });
}
