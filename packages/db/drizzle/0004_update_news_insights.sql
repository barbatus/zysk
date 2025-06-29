ALTER TABLE "app_data"."news_insights" ADD COLUMN "news_title" text NOT NULL;--> statement-breakpoint
ALTER TABLE "app_data"."news_insights" ADD COLUMN "url" varchar(2048) NOT NULL;