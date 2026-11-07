ALTER TABLE "content_authors" ADD COLUMN IF NOT EXISTS "youtube" text;--> statement-breakpoint
ALTER TABLE "content_authors" ADD COLUMN IF NOT EXISTS "threads" text;--> statement-breakpoint
ALTER TABLE "content_authors" ADD COLUMN IF NOT EXISTS "instagram" text;