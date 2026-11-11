import type { autopilotAgentActionSchema } from "@notra/ai/schemas/autopilot-agent";
import type { z } from "zod";

export type AutopilotAgentAction = z.input<typeof autopilotAgentActionSchema>;

export interface AutopilotToolSpec<TSchema extends z.ZodType> {
  readonly description: string;
  readonly inputSchema: TSchema;
  readonly activityLabel: string;
  readonly needsConfirmation: ((input: z.infer<TSchema>) => boolean) | null;
  readonly toAction: (input: z.infer<TSchema>) => AutopilotAgentAction;
}
