-- Two Vercel imports broke on 2026-11-10/11 (Tinybird delete queue full,
-- then a 403 right after a rate limit). One ended "completed" with most of
-- its rows deleted by a late cleanup job, the other "failed" with its
-- connection marked for reauth. Both go back to pending so the monitoring
-- cron's recovery restarts them; attempts = 1 makes every chunk delete its
-- window before writing, so nothing is counted twice. An import is left
-- alone when another non-failed import of the same source exists (a retry
-- the customer already started), which also keeps the active-source unique
-- index intact. Outside production no row matches.
UPDATE "analytics_imports" AS i
SET
	"status" = 'pending',
	"chunks_done" = 0,
	"rows_written" = 0,
	"pageviews_imported" = 0,
	"last_error" = NULL,
	"retry_at" = NULL,
	"completed_at" = NULL,
	"recovery_attempts" = 0
WHERE i."id" IN ('imp_va5jMnnWdz4MW_Vq', 'imp_mQI4MNcQpYgURC2F')
	AND i."status" IN ('completed', 'failed')
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
	"attempts" = 1,
	"rows_written" = 0,
	"pageviews" = 0,
	"last_error" = NULL
WHERE "import_id" IN (
	SELECT "id"
	FROM "analytics_imports"
	WHERE "id" IN ('imp_va5jMnnWdz4MW_Vq', 'imp_mQI4MNcQpYgURC2F')
		AND "status" = 'pending'
);
--> statement-breakpoint
UPDATE "analytics_import_connections"
SET "status" = 'active', "last_error" = NULL
WHERE "status" = 'reauth_required'
	AND "id" IN (
		SELECT "connection_id"
		FROM "analytics_imports"
		WHERE "id" = 'imp_mQI4MNcQpYgURC2F'
			AND "status" = 'pending'
	);
