CREATE TABLE "geo_products" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"niche" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "geo_prompts" ADD COLUMN "product_id" text;--> statement-breakpoint
ALTER TABLE "geo_prompts" ADD COLUMN "intent" text;--> statement-breakpoint
ALTER TABLE "geo_products" ADD CONSTRAINT "geo_products_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_products" ADD CONSTRAINT "geo_products_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "geoProducts_organizationId_idx" ON "geo_products" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "geoProducts_projectId_name_uidx" ON "geo_products" USING btree ("project_id","name");--> statement-breakpoint
ALTER TABLE "geo_prompts" ADD CONSTRAINT "geo_prompts_product_id_geo_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."geo_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "geoPrompts_productId_idx" ON "geo_prompts" USING btree ("product_id");