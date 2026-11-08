CREATE TABLE "analytics_import_chunks" (
	"import_id" text NOT NULL,
	"chunk_start" date NOT NULL,
	"chunk_end" date NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"rows_written" integer DEFAULT 0 NOT NULL,
	"pageviews" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_import_chunks_import_id_chunk_start_pk" PRIMARY KEY("import_id","chunk_start")
);
--> statement-breakpoint
CREATE TABLE "analytics_import_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"label" text NOT NULL,
	"external_account_id" text,
	"encrypted_credentials" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_error" text,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_imports" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"site_id" text,
	"connection_id" text,
	"provider" text NOT NULL,
	"kind" text NOT NULL,
	"external_site_ref" text NOT NULL,
	"external_site_label" text,
	"host" text NOT NULL,
	"requested_start_day" date,
	"requested_end_day" date,
	"cutoff_day" date,
	"effective_start_day" date,
	"effective_end_day" date,
	"capabilities" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"chunks_total" integer DEFAULT 0 NOT NULL,
	"chunks_done" integer DEFAULT 0 NOT NULL,
	"rows_written" integer DEFAULT 0 NOT NULL,
	"pageviews_imported" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"retry_at" timestamp,
	"upload_object_key" text,
	"workflow_run_id" text,
	"recovery_attempts" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "analytics_import_chunks" ADD CONSTRAINT "analytics_import_chunks_import_id_analytics_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."analytics_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_import_connections" ADD CONSTRAINT "analytics_import_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_import_connections" ADD CONSTRAINT "analytics_import_connections_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_imports" ADD CONSTRAINT "analytics_imports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_imports" ADD CONSTRAINT "analytics_imports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_imports" ADD CONSTRAINT "analytics_imports_connection_id_analytics_import_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."analytics_import_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_imports" ADD CONSTRAINT "analytics_imports_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analyticsImportConnections_organizationId_idx" ON "analytics_import_connections" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "analyticsImports_organizationId_status_idx" ON "analytics_imports" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "analyticsImports_projectId_idx" ON "analytics_imports" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "analyticsImports_connectionId_idx" ON "analytics_imports" USING btree ("connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "analyticsImports_active_source_uidx" ON "analytics_imports" USING btree ("project_id","provider","external_site_ref","host") WHERE "analytics_imports"."status" IN ('pending', 'running', 'waiting_rate_limit');--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "geo_web_key_generation" integer DEFAULT 0 NOT NULL;