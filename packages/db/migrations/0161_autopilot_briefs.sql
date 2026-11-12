CREATE TABLE "autopilot_briefs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"run_id" text,
	"content" jsonb NOT NULL,
	"slack_team_id" text,
	"slack_channel_id" text,
	"slack_message_ts" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "autopilot_briefs" ADD CONSTRAINT "autopilot_briefs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autopilot_briefs" ADD CONSTRAINT "autopilot_briefs_run_id_autopilot_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."autopilot_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "autopilotBriefs_runId_uidx" ON "autopilot_briefs" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "autopilotBriefs_organizationId_createdAt_idx" ON "autopilot_briefs" USING btree ("organization_id","created_at");