import { withAdvisorySessionLocks } from "@notra/db/utils/advisory-session-lock";
import type {
  DiscardTotpEnrollmentInput,
  RegenerateBackupCodesInput,
  RemoveAuthFactorInput,
  VerifyTotpEnrollmentInput,
} from "@notra/schemas/types/dashboard/auth";
import { previewIssuerLockKey } from "@notra/sites-core/utils/preview-issuer-lock";
import { type } from "@orpc/server";

import {
  discardTotpEnrollment,
  getSecurityOverview,
  regenerateBackupCodes,
  removeAuthFactor,
  startTotpEnrollment,
  verifyTotpEnrollment,
} from "@/lib/auth/security-actions";
import {
  deleteUser,
  listAccounts,
  requestPasswordReset,
  unlinkAccount,
  updateUser,
} from "@/lib/auth/user-actions";
import { authorizedProcedure, baseProcedure } from "@/lib/orpc/base";
import type {
  UnlinkAccountInput,
  UpdateUserInput,
} from "@/types/auth/user-actions";

export const userAccountRouter = {
  update: baseProcedure
    .input(type<UpdateUserInput>())
    .handler(({ input }) => updateUser(input)),
  delete: authorizedProcedure.handler(({ context }) =>
    withAdvisorySessionLocks([previewIssuerLockKey(context.user.id)], () =>
      deleteUser()
    )
  ),
  requestPasswordReset: baseProcedure.handler(() => requestPasswordReset()),
  listConnections: baseProcedure.handler(() => listAccounts()),
  unlinkConnection: baseProcedure
    .input(type<UnlinkAccountInput>())
    .handler(({ input }) => unlinkAccount(input)),
};

export const userSecurityRouter = {
  overview: baseProcedure.handler(() => getSecurityOverview()),
  startTotpEnrollment: baseProcedure.handler(() => startTotpEnrollment()),
  discardTotpEnrollment: baseProcedure
    .input(type<DiscardTotpEnrollmentInput>())
    .handler(({ input }) => discardTotpEnrollment(input)),
  verifyTotpEnrollment: baseProcedure
    .input(type<VerifyTotpEnrollmentInput>())
    .handler(({ input }) => verifyTotpEnrollment(input)),
  regenerateBackupCodes: baseProcedure
    .input(type<RegenerateBackupCodesInput>())
    .handler(({ input }) => regenerateBackupCodes(input)),
  removeAuthFactor: baseProcedure
    .input(type<RemoveAuthFactorInput>())
    .handler(({ input }) => removeAuthFactor(input)),
};
