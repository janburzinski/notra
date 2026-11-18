ALTER TABLE "geo_prompt_suggestions" ADD COLUMN "product_id" text;--> statement-breakpoint
ALTER TABLE "geo_prompt_suggestions" ADD COLUMN "intent" text;--> statement-breakpoint
ALTER TABLE "geo_prompt_suggestions" ADD CONSTRAINT "geo_prompt_suggestions_product_id_geo_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."geo_products"("id") ON DELETE cascade ON UPDATE no action;