export type GeoProjectSetupWorkflowResult =
  | { status: "completed" }
  | { status: "invalid_payload" }
  | { status: "superseded" };
