ALTER TABLE "app_data"."stock_news" ALTER COLUMN "symbol" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app_data"."stock_news" ADD COLUMN IF NOT EXISTS "impact" text DEFAULT 'neutral';
