import { organizationIdInputSchema } from "@notra/schemas/dashboard/auth/organization";
import { webhookLogDetailInputSchema } from "@notra/schemas/dashboard/logs";

import { authorizedProcedure, withOrganizationAccess } from "@/lib/orpc/base";
import { notFound } from "@/lib/orpc/utils/errors";
import { listWebhookLogs } from "@/lib/webhooks/logging";

export const logsRouter = {
  webhooks: {
    overview: authorizedProcedure
      .input(organizationIdInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const logs = await listWebhookLogs(
          input.organizationId,
          "github",
          null
        );
        return {
          logs: logs.map(({ payload, ...log }) => ({
            ...log,
            hasPayload: Boolean(payload && Object.keys(payload).length > 0),
          })),
        };
      }),
    get: authorizedProcedure
      .input(webhookLogDetailInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const logs = await listWebhookLogs(
          input.organizationId,
          "github",
          null
        );
        const log = logs.find((entry) => entry.id === input.logId);
        if (!log) {
          throw notFound(
            "This log is no longer available. It may have expired."
          );
        }
        return log;
      }),
  },
};
