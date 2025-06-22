CREATE TABLE IF NOT EXISTS "app_data"."news_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"url" varchar(2048) NOT NULL,
	"settings" jsonb DEFAULT '{"maxLevelToCrawl":10}'::jsonb,
	"created_at" timestamp with time zone DEFAULT current_timestamp NOT NULL,
	"updated_at" timestamp with time zone DEFAULT current_timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_data"."stock_news" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_url" ON "app_data"."news_sources" USING btree ("url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "insights_gin_idx" ON "app_data"."stock_news" USING gin (insights jsonb_path_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "url_idx" ON "app_data"."stock_news" USING btree ("url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "original_url_idx" ON "app_data"."stock_news" USING btree ("original_url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "news_date_idx" ON "app_data"."stock_news" USING btree ("news_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "status_idx" ON "app_data"."stock_news" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "url_status_idx" ON "app_data"."stock_news" USING btree ("url","status");