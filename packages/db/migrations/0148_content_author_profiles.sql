ALTER TABLE "content_authors" ADD COLUMN IF NOT EXISTS "bluesky" text;--> statement-breakpoint
ALTER TABLE "content_authors" ADD COLUMN IF NOT EXISTS "mastodon" text;