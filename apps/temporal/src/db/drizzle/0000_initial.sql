CREATE SCHEMA "api_data";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_data"."alpha_vantage_time_series" (
	"symbol" varchar(40) PRIMARY KEY NOT NULL,
	"open_price" numeric NOT NULL,
	"close_price" numeric NOT NULL,
	"high" numeric NOT NULL,
	"low" numeric NOT NULL,
	"volume" numeric NOT NULL,
	"date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_data"."alpha_vantage_company_overview" (
	"symbol" varchar(40) PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"currency" varchar(10),
	"sector" text NOT NULL,
	"country" varchar(10) NOT NULL,
	"beta" numeric
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_data"."alpha_vantage_etf_profile" (
	"symbol" varchar(40) PRIMARY KEY NOT NULL,
	"sectors" jsonb DEFAULT '[]'::jsonb,
	"holdings" jsonb DEFAULT '[]'::jsonb,
	"inception_date" timestamp with time zone
);
