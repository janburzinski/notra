ALTER TABLE "geo_settings" ADD COLUMN "removed_product_names" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "geo_settings" ADD COLUMN "products_checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "geo_settings" ADD COLUMN "products_site_hash" text;