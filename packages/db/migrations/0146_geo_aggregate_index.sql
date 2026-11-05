-- The index can be built ahead of the deploy without blocking writes:
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS "geoMentionChecks_project_captured_agg_idx" ON "geo_mention_checks" USING btree ("project_id","captured_at","organization_id","language","engine","prompt_id","scan_id","sequence_id","persona_id","turn","mentioned","owned_source_cited","position","sentiment");
-- A failed concurrent build leaves an invalid index under that name; it is
-- rebuilt here before the old indexes go.
-- The drops need an exclusive lock; fail instead of queueing reads behind it.
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_index
    WHERE indexrelid = to_regclass('public."geoMentionChecks_project_captured_agg_idx"')
      AND NOT indisvalid
  ) THEN
    DROP INDEX "geoMentionChecks_project_captured_agg_idx";
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "geoMentionChecks_project_captured_agg_idx" ON "geo_mention_checks" USING btree ("project_id","captured_at","organization_id","language","engine","prompt_id","scan_id","sequence_id","persona_id","turn","mentioned","owned_source_cited","position","sentiment");--> statement-breakpoint
DROP INDEX IF EXISTS "geoMentionChecks_projectId_capturedAt_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "geoMentionChecks_project_captured_cover_idx";--> statement-breakpoint
SET LOCAL lock_timeout = DEFAULT;
