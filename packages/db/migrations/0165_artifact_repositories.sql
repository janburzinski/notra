-- Artifacts made before they moved to code.storage have no repository. They
-- are hours old, so they go; a brief that pointed at one shows its own page.
-- Everything else only adds, so the app still running during the deploy keeps
-- working: artifact_versions and deleted_at stay, and the defaults let its
-- inserts succeed (the new app hides those rows). A follow-up migration
-- removes all of it.
DELETE FROM "artifacts";--> statement-breakpoint
CREATE TABLE "artifact_revisions" (
	"artifact_id" text NOT NULL,
	"version" integer NOT NULL,
	"sha" text NOT NULL,
	"actor" text NOT NULL,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "artifact_revisions_artifact_id_version_pk" PRIMARY KEY("artifact_id","version")
);
--> statement-breakpoint
CREATE TABLE "code_storage_deletions" (
	"repo_id" text PRIMARY KEY NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "head_sha" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "content" jsonb DEFAULT '{"title":"","blocks":[]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "share_version" integer;--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "share_content" jsonb;--> statement-breakpoint
ALTER TABLE "artifact_revisions" ADD CONSTRAINT "artifact_revisions_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_revisions" ADD CONSTRAINT "artifact_revisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "codeStorageDeletions_nextAttemptAt_idx" ON "code_storage_deletions" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "artifacts_organizationId_updatedAt_idx" ON "artifacts" USING btree ("organization_id","updated_at");--> statement-breakpoint
-- Whatever deletes an artifact (its own delete or its workspace's cascade)
-- queues its repository; the prefix matches ARTIFACT_REPO_PREFIX.
CREATE FUNCTION notra_queue_artifact_repo_deletion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO code_storage_deletions (repo_id) VALUES ('notra-artifact-' || OLD.id)
  ON CONFLICT (repo_id) DO UPDATE SET next_attempt_at = now();
  RETURN OLD;
END;
$$;--> statement-breakpoint
CREATE TRIGGER artifacts_queue_repo_deletion AFTER DELETE ON artifacts
FOR EACH ROW EXECUTE FUNCTION notra_queue_artifact_repo_deletion();
