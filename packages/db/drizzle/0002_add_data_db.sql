CREATE SCHEMA "app_data";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_data"."alpha_vantage_time_series" (
	"symbol" varchar(40) PRIMARY KEY NOT NULL,
	"open_price" numeric NOT NULL,
	"close_price" numeric NOT NULL,
	"high" numeric NOT NULL,
	"low" numeric NOT NULL,
	"volume" numeric NOT NULL,
	"date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_data"."alpha_vantage_company_overviews" (
	"symbol" varchar(40) PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"currency" varchar(10),
	"sector" text NOT NULL,
	"country" varchar(10) NOT NULL,
	"beta" numeric
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_data"."alpha_vantage_etf_profiles" (
	"symbol" varchar(40) PRIMARY KEY NOT NULL,
	"sectors" jsonb DEFAULT '[]'::jsonb,
	"holdings" jsonb DEFAULT '[]'::jsonb,
	"inception_date" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_data"."experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"response_text" text,
	"response_json" jsonb,
	"details" jsonb,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT current_timestamp NOT NULL,
	"updated_at" timestamp with time zone DEFAULT current_timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_data"."stock_news" (
	"symbol" varchar(40) NOT NULL,
	"url" varchar(255) NOT NULL,
	"status" text NOT NULL,
	"token_size" integer,
	"markdown" text,
	"news_date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT current_timestamp NOT NULL,
	"updated_at" timestamp with time zone DEFAULT current_timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_symbol_url" ON "app_data"."stock_news" USING btree ("symbol","url");