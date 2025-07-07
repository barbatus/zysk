DROP INDEX IF EXISTS "url_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "original_url_idx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "symbol_url_idx" ON "app_data"."stock_news" USING btree ("symbol","url");