import type { SlackThread } from "eve/channels/slack";
import type { Session } from "eve/sessions";
import type { z } from "zod";

import type { slackControlValueSchema } from "../schemas/slack-controls";

export type SlackControl = "stop" | "leave";

export interface SlackControlContext {
  thread: Pick<SlackThread, "post">;
  resolveSession(): Promise<Pick<Session, "id" | "cancel" | "end"> | undefined>;
}

export type SlackControlValue = z.infer<typeof slackControlValueSchema>;
