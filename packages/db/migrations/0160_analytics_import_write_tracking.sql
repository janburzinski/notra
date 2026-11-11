ALTER TABLE "analytics_import_chunks" ADD COLUMN IF NOT EXISTS "write_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "analytics_imports" ADD COLUMN IF NOT EXISTS "purge_pending" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Before this release a retry deleted whenever an earlier attempt existed.
-- An unfinished chunk of an active import with an attempt on record may have
-- written rows, so it keeps that delete once.
UPDATE "analytics_import_chunks" AS c
SET "write_started_at" = now()
FROM "analytics_imports" AS i
WHERE i."id" = c."import_id"
	AND i."status" IN ('pending', 'running', 'waiting_rate_limit')
	AND c."status" <> 'done'
	AND c."attempts" > 0
	AND c."write_started_at" IS NULL;
--> statement-breakpoint
-- The two Vercel imports re-armed by 0158 failed again on Tinybird's delete
-- queue before this release. They start over once more: every chunk counts
-- as written, so each deletes its own days once before writing and nothing is
-- counted twice. Same guards as 0158; outside production no row matches.
UPDATE "analytics_imports" AS i
SET
	"status" = 'pending',
	"chunks_done" = 0,
	"rows_written" = 0,
	"pageviews_imported" = 0,
	"last_error" = NULL,
	"retry_at" = NULL,
	"completed_at" = NULL,
	"recovery_attempts" = 0,
	"purge_pending" = false
WHERE i."id" IN ('imp_va5jMnnWdz4MW_Vq', 'imp_mQI4MNcQpYgURC2F')
	AND i."status" IN ('pending', 'running', 'waiting_rate_limit', 'failed')
	AND NOT EXISTS (
		SELECT 1
		FROM "analytics_imports" AS other
		WHERE other."id" <> i."id"
			AND other."project_id" = i."project_id"
			AND other."provider" = i."provider"
			AND other."external_site_ref" = i."external_site_ref"
			AND other."host" = i."host"
			AND other."status" NOT IN ('failed', 'deleting', 'deleted')
	);
--> statement-breakpoint
UPDATE "analytics_import_chunks"
SET
	"status" = 'pending',
	"attempts" = 0,
	"rows_written" = 0,
	"pageviews" = 0,
	"last_error" = NULL,
	"write_started_at" = now()
WHERE "import_id" IN (
	SELECT "id"
	FROM "analytics_imports"
	WHERE "id" IN ('imp_va5jMnnWdz4MW_Vq', 'imp_mQI4MNcQpYgURC2F')
		AND "status" = 'pending'
);
