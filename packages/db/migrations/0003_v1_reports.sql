ALTER TABLE "reports" ADD COLUMN "segments" jsonb;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "summary_source" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_shareToken_unique" UNIQUE("share_token");