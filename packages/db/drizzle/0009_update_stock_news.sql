ALTER TABLE "app_data"."stock_news" ADD COLUMN "insights" jsonb DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "app_data"."stock_news" ADD COLUMN "insights_token_size" integer DEFAULT 0;
