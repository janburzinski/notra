CREATE TABLE "autopilot_workflows" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"graph" jsonb NOT NULL,
	"schedule" jsonb,
	"enabled" boolean DEFAULT false NOT NULL,
	"qstash_schedule_id" text,
	"created_by_user_id" text,
	"last_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "autopilot_workflows" ADD CONSTRAINT "autopilot_workflows_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autopilot_workflows" ADD CONSTRAINT "autopilot_workflows_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "autopilotWorkflows_organizationId_updatedAt_idx" ON "autopilot_workflows" USING btree ("organization_id","updated_at");
