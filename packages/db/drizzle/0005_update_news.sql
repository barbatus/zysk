ALTER TABLE "app_data"."stock_news" RENAME COLUMN "symbol" TO "main_symbol";--> statement-breakpoint
DROP INDEX IF EXISTS "unique_symbol_url";--> statement-breakpoint
DROP INDEX IF EXISTS "original_url_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "url_idx";--> statement-breakpoint
ALTER TABLE "app_data"."stock_news" ALTER COLUMN "original_url" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app_data"."stock_news" ADD COLUMN "extracted_symbols" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "app_data"."stock_news" ADD COLUMN "experiement_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app_data"."stock_news" ADD CONSTRAINT "stock_news_experiement_id_experiments_id_fk" FOREIGN KEY ("experiement_id") REFERENCES "app_data"."experiments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extracted_symbols_gin_idx" ON "app_data"."stock_news" USING gin (extracted_symbols jsonb_path_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "main_symbol_idx" ON "app_data"."stock_news" USING btree ("main_symbol");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "experiement_id_idx" ON "app_data"."stock_news" USING btree ("experiement_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "url_idx" ON "app_data"."stock_news" USING btree ("url");
