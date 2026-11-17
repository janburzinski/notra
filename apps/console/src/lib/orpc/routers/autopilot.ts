import {
  autopilotAdminRunsInputSchema,
  autopilotAdminRunsResponseSchema,
  autopilotAdminTraceInputSchema,
  autopilotAdminTraceResponseSchema,
} from "@notra/schemas/api/autopilot-admin";

import { assertAdmin } from "@/lib/auth/admin";
import { callAutopilotAdmin } from "@/lib/autopilot/dashboard";
import { getAutopilotHealth } from "@/lib/autopilot/health";
import { baseProcedure } from "@/lib/orpc/base";
import { autopilotHealthInputSchema } from "@/schemas/autopilot";

export const autopilotRouter = {
  health: baseProcedure
    .input(autopilotHealthInputSchema)
    .handler(async ({ context, input }) => {
      await assertAdmin({ headers: context.headers });
      return getAutopilotHealth(input.days);
    }),
  runs: baseProcedure
    .input(autopilotAdminRunsInputSchema.omit({ action: true }))
    .handler(async ({ context, input }) => {
      await assertAdmin({ headers: context.headers });
      return callAutopilotAdmin(
        { ...input, action: "runs" },
        autopilotAdminRunsResponseSchema
      );
    }),
  trace: baseProcedure
    .input(autopilotAdminTraceInputSchema.omit({ action: true }))
    .handler(async ({ context, input }) => {
      await assertAdmin({ headers: context.headers });
      return callAutopilotAdmin(
        { ...input, action: "trace" },
        autopilotAdminTraceResponseSchema
      );
    }),
};
