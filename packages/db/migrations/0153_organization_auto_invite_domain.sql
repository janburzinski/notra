ALTER TABLE "organizations" ADD COLUMN "auto_invite_domain" text;--> statement-breakpoint
CREATE INDEX "organizations_autoInviteDomain_idx" ON "organizations" USING btree ("auto_invite_domain");