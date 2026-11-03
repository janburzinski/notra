import { createWorkflowBlockRegistry } from "@notra/workflows/runtime/registry";

import { draftBlocks } from "./autopilot/drafts";
import { readinessBlocks } from "./autopilot/readiness";
import { autopilotRunBlocks } from "./autopilot/run";
import { templateBlocks } from "./autopilot/templates";

export const workflowBlockRegistry = createWorkflowBlockRegistry([
  ...autopilotRunBlocks,
  ...readinessBlocks,
  ...draftBlocks,
  ...templateBlocks,
]);
