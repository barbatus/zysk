ALTER TABLE "predictions" ADD COLUMN "evaluation" numeric;--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN "type" text DEFAULT 'weekly';--> statement-breakpoint
ALTER TABLE "app_data"."stock_news" DROP COLUMN IF EXISTS "insights_token_size";