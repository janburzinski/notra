import { organizationIdInputSchema } from "@notra/schemas/dashboard/auth/organization";
import { listAutomationRunsInputSchema } from "@notra/schemas/dashboard/automation/runs";
import {
  configureEventTriggerBodySchema,
  configureScheduleBodySchema,
  schedulesListInputSchema,
  triggerInputSchema,
} from "@notra/schemas/dashboard/integrations";

import {
  listAutomationRuns,
  listLatestAutomationRuns,
} from "@/lib/automation/runs";
import {
  createEventTrigger,
  createScheduleTrigger,
  deleteAutomationTrigger,
  listEventTriggers,
  listScheduleTriggers,
  runScheduleNow,
  updateEventTrigger,
  updateScheduleTrigger,
} from "@/lib/automation/triggers";
import { assertActiveSubscription } from "@/lib/billing/subscription";
import { getTranslations } from "@/lib/i18n/server";
import { baseProcedure, withOrganizationAccess } from "@/lib/orpc/base";
import { automationAlertsRouter } from "@/lib/orpc/routers/automation-alerts";
import type { AutomationActor } from "@/types/automation/service";
import type { ORPCContext } from "@/types/orpc/context";

import { withAutomationRpcErrors } from "../utils/automation-errors";

function requestActor(
  context: ORPCContext & { auth: { user: { id: string } } },
  organizationId: string
): AutomationActor {
  return {
    organizationId,
    userId: context.auth.user.id,
    headers: context.headers,
  };
}

async function untitledScheduleName() {
  return (await getTranslations("automation.schedules.page"))("untitled");
}

const deleteTrigger = baseProcedure
  .input(triggerInputSchema)
  .use(withOrganizationAccess)
  .handler(({ context, input }) =>
    withAutomationRpcErrors(() =>
      deleteAutomationTrigger(
        requestActor(context, input.organizationId),
        input.triggerId
      )
    )
  );

export const automationRouter = {
  alerts: automationAlertsRouter,
  runs: {
    list: baseProcedure
      .input(listAutomationRunsInputSchema)
      .use(withOrganizationAccess)
      .handler(({ input }) => listAutomationRuns(input)),
    latest: baseProcedure
      .input(organizationIdInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => ({
        lastRunAt: await listLatestAutomationRuns(input.organizationId),
      })),
  },
  events: {
    list: baseProcedure
      .input(schedulesListInputSchema)
      .use(withOrganizationAccess)
      .handler(({ input }) =>
        listEventTriggers(input.organizationId, input.repositoryIds)
      ),
    create: baseProcedure
      .input(organizationIdInputSchema.and(configureEventTriggerBodySchema))
      .use(withOrganizationAccess)
      .handler(async ({ context, input }) => {
        await assertActiveSubscription(input.organizationId);
        const { organizationId, ...body } = input;
        return withAutomationRpcErrors(() =>
          createEventTrigger(requestActor(context, organizationId), body)
        );
      }),
    update: baseProcedure
      .input(triggerInputSchema.and(configureEventTriggerBodySchema))
      .use(withOrganizationAccess)
      .handler(async ({ context, input }) => {
        await assertActiveSubscription(input.organizationId);
        const { organizationId, triggerId, ...body } = input;
        return withAutomationRpcErrors(() =>
          updateEventTrigger(
            requestActor(context, organizationId),
            triggerId,
            body
          )
        );
      }),
    delete: deleteTrigger,
  },
  schedules: {
    list: baseProcedure
      .input(schedulesListInputSchema)
      .use(withOrganizationAccess)
      .handler(({ input }) =>
        listScheduleTriggers(input.organizationId, input.repositoryIds)
      ),
    create: baseProcedure
      .input(organizationIdInputSchema.and(configureScheduleBodySchema))
      .use(withOrganizationAccess)
      .handler(async ({ context, input }) => {
        await assertActiveSubscription(input.organizationId);
        const { organizationId, ...body } = input;
        const untitled = await untitledScheduleName();
        return withAutomationRpcErrors(() =>
          createScheduleTrigger(
            requestActor(context, organizationId),
            body,
            untitled
          )
        );
      }),
    update: baseProcedure
      .input(triggerInputSchema.and(configureScheduleBodySchema))
      .use(withOrganizationAccess)
      .handler(async ({ context, input }) => {
        await assertActiveSubscription(input.organizationId);
        const { organizationId, triggerId, ...body } = input;
        const untitled = await untitledScheduleName();
        return withAutomationRpcErrors(() =>
          updateScheduleTrigger(
            requestActor(context, organizationId),
            triggerId,
            body,
            untitled
          )
        );
      }),
    delete: deleteTrigger,
    runNow: baseProcedure
      .input(triggerInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ context, input }) => {
        await assertActiveSubscription(input.organizationId);
        return withAutomationRpcErrors(() =>
          runScheduleNow(
            requestActor(context, input.organizationId),
            input.triggerId
          )
        );
      }),
  },
};
