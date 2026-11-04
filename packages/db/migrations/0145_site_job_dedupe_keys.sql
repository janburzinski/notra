CREATE TABLE IF NOT EXISTS "site_job_dedupe_keys" (
	"dedupe_key" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "site_job_dedupe_keys" ADD CONSTRAINT "site_job_dedupe_keys_job_id_site_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."site_jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "siteJobDedupeKeys_jobId_idx" ON "site_job_dedupe_keys" USING btree ("job_id");
