CREATE TABLE "slack_agent_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"slack_team_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"thread_ts" text NOT NULL,
	"message_ts" text NOT NULL,
	"slack_user_id" text,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"session_id" text,
	"turn_id" text,
	"tool_names" text[] DEFAULT '{}'::text[] NOT NULL,
	"error_code" text,
	"sent_at" timestamp NOT NULL,
	"started_at" timestamp,
	"first_response_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "slack_agent_requests_trigger_check" CHECK ("slack_agent_requests"."trigger" IN ('mention', 'direct_message', 'thread_reply')),
	CONSTRAINT "slack_agent_requests_status_check" CHECK ("slack_agent_requests"."status" IN ('blocked', 'pending', 'completed', 'failed', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "slack_agent_requests" ADD CONSTRAINT "slack_agent_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "slackAgentRequests_team_channel_message_uidx" ON "slack_agent_requests" USING btree ("slack_team_id","channel_id","message_ts");--> statement-breakpoint
CREATE INDEX "slackAgentRequests_createdAt_idx" ON "slack_agent_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "slackAgentRequests_org_createdAt_idx" ON "slack_agent_requests" USING btree ("organization_id","created_at");