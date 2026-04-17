CREATE TYPE "public"."chat_visibility" AS ENUM('private', 'link', 'password', 'organization');--> statement-breakpoint
CREATE TABLE "chat_share_invitees" (
	"id" text PRIMARY KEY NOT NULL,
	"share_id" text NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"visibility" "chat_visibility" DEFAULT 'private' NOT NULL,
	"share_token" text,
	"password_hash" text,
	"allow_fork" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_share_invitees" ADD CONSTRAINT "chat_share_invitees_share_id_chat_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."chat_shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_share_invitees" ADD CONSTRAINT "chat_share_invitees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_shares" ADD CONSTRAINT "chat_shares_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_shares" ADD CONSTRAINT "chat_shares_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chatShareInvitees_shareId_idx" ON "chat_share_invitees" USING btree ("share_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chatShareInvitees_share_email_uidx" ON "chat_share_invitees" USING btree ("share_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "chatShares_org_chat_uidx" ON "chat_shares" USING btree ("organization_id","chat_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chatShares_shareToken_uidx" ON "chat_shares" USING btree ("share_token") WHERE "chat_shares"."share_token" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "chatShares_expiresAt_idx" ON "chat_shares" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "chatShares_ownerUserId_idx" ON "chat_shares" USING btree ("owner_user_id");