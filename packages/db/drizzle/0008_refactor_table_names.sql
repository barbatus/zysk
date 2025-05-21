ALTER TABLE "app_data"."alpha_vantage_company_overviews" RENAME TO "company_profiles";--> statement-breakpoint
ALTER TABLE "app_data"."alpha_vantage_etf_profiles" RENAME TO "etf_profiles";--> statement-breakpoint
ALTER TABLE "app_data"."alpha_vantage_time_series" RENAME TO "ticker_time_series";--> statement-breakpoint
ALTER TABLE "app_data"."stock_news" ALTER COLUMN "token_size" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "app_data"."stock_news" ALTER COLUMN "token_size" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "user_id" SET NOT NULL;