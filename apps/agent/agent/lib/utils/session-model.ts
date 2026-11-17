import { gatewayAttributionOptions } from "@notra/ai/utils/usage-attribution";
import { getOrganizationId } from "@notra/tools/utils/organization";
import { defineDynamic } from "eve/models";

import { createAgentModel } from "./model";

export function createSessionAgentModel(
  modelId: string,
  tag: string,
  modelContextWindowTokens: number
) {
  return defineDynamic((ctx) => {
    const organizationId = getOrganizationId(ctx);
    return {
      model: createAgentModel(modelId, tag, organizationId),
      modelContextWindowTokens,
      modelOptions: {
        providerOptions: {
          gateway: gatewayAttributionOptions({
            organizationId,
            sessionId: ctx.session.id,
            turnId: ctx.turn?.id,
          }),
        },
      },
    };
  });
}
