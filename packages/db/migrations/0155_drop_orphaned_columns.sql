ALTER TABLE "sites" DROP CONSTRAINT IF EXISTS "sites_publishMode_check";--> statement-breakpoint
ALTER TABLE "brand_references" DROP COLUMN IF EXISTS "supermemory_document_id";--> statement-breakpoint
ALTER TABLE "brand_references" DROP COLUMN IF EXISTS "supermemory_memory_id";--> statement-breakpoint
ALTER TABLE "brand_references" DROP COLUMN IF EXISTS "supermemory_synced_at";--> statement-breakpoint
ALTER TABLE "brand_references" DROP COLUMN IF EXISTS "supermemory_last_sync_error";--> statement-breakpoint
ALTER TABLE "sites" DROP COLUMN IF EXISTS "publish_mode";