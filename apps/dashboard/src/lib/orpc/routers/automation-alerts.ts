import { organizationIdInputSchema } from "@notra/schemas/dashboard/auth/organization";
import {
  createGeoAlertInputSchema,
  geoAlertTriggerInputSchema,
  updateGeoAlertInputSchema,
} from "@notra/schemas/dashboard/automation/geo-alerts";

import {
  createGeoAlert,
  deleteGeoAlert,
  loadGeoAlertDestinations,
  sendGeoAlertTestFor,
  updateGeoAlert,
} from "@/lib/automation/geo-alert-service";
import { listGeoAlertAutomations } from "@/lib/automation/geo-alerts";
import { assertActiveSubscription } from "@/lib/billing/subscription";
import { baseProcedure, withOrganizationAccess } from "@/lib/orpc/base";

import { withAutomationRpcErrors } from "../utils/automation-errors";

export const automationAlertsRouter = {
  list: baseProcedure
    .input(organizationIdInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => ({
      alerts: await listGeoAlertAutomations(input.organizationId),
    })),
  /** Where alerts can go right now, so the form can explain empty channels. */
  destinations: baseProcedure
    .input(organizationIdInputSchema)
    .use(withOrganizationAccess)
    .handler(({ input }) => loadGeoAlertDestinations(input.organizationId)),
  create: baseProcedure
    .input(createGeoAlertInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const { organizationId, ...body } = input;
      await assertActiveSubscription(organizationId);
      return withAutomationRpcErrors(() =>
        createGeoAlert(
          {
            organizationId,
            userId: context.auth.user.id,
            headers: context.headers,
          },
          body
        )
      );
    }),
  update: baseProcedure
    .input(updateGeoAlertInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const { organizationId, triggerId, ...body } = input;
      await assertActiveSubscription(organizationId);
      return withAutomationRpcErrors(() =>
        updateGeoAlert(
          {
            organizationId,
            userId: context.auth.user.id,
            headers: context.headers,
          },
          triggerId,
          body
        )
      );
    }),
  delete: baseProcedure
    .input(geoAlertTriggerInputSchema)
    .use(withOrganizationAccess)
    .handler(({ context, input }) =>
      withAutomationRpcErrors(() =>
        deleteGeoAlert(
          {
            organizationId: input.organizationId,
            userId: context.auth.user.id,
            headers: context.headers,
          },
          input.triggerId
        )
      )
    ),
  sendTest: baseProcedure
    .input(geoAlertTriggerInputSchema)
    .use(withOrganizationAccess)
    .handler(({ input }) =>
      withAutomationRpcErrors(() =>
        sendGeoAlertTestFor(input.organizationId, input.triggerId)
      )
    ),
};
