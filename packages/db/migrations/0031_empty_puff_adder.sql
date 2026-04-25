CREATE TABLE IF NOT EXISTS "chat_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"filename" text NOT NULL,
	"media_type" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_attachments_key_unique" UNIQUE("key")
);--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD COLUMN IF NOT EXISTS "organization_id" text;--> statement-breakpoint
UPDATE "chat_attachments"
SET "organization_id" = split_part("key", '/', 2)
WHERE "organization_id" IS NULL
  AND "key" LIKE 'organization/%/chat/%';--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "chat_attachments"
    WHERE "organization_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'chat_attachments contains rows that could not be backfilled with organization_id';
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chat_attachments_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "chat_attachments"
      ADD CONSTRAINT "chat_attachments_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chat_attachments_organization_id_organizations_id_fk'
  ) THEN
    ALTER TABLE "chat_attachments"
      ADD CONSTRAINT "chat_attachments_organization_id_organizations_id_fk"
      FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "chat_attachments" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "chatAttachments_userId_createdAt_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chatAttachments_organizationId_createdAt_idx" ON "chat_attachments" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chatAttachments_userId_idx" ON "chat_attachments" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "chat_attachment_retention_days";
