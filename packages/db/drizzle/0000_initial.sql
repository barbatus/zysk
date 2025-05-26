CREATE SCHEMA IF NOT EXISTS "app_data";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_data"."experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"response_text" text,
	"response_json" jsonb,
	"details" jsonb,
	"status" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT current_timestamp NOT NULL,
	"updated_at" timestamp with time zone DEFAULT current_timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(255) NOT NULL,
	"prediction" text NOT NULL,
	"confidence" numeric NOT NULL,
	"response_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT current_timestamp NOT NULL,
	"updated_at" timestamp with time zone DEFAULT current_timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "current_quotes" (
	"symbol" varchar(40) PRIMARY KEY NOT NULL,
	"price" numeric NOT NULL,
	"created_at" timestamp with time zone DEFAULT current_timestamp NOT NULL,
	"updated_at" timestamp with time zone DEFAULT current_timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ticker_quotes" (
	"symbol" varchar(40) NOT NULL,
	"open_price" numeric NOT NULL,
	"close_price" numeric NOT NULL,
	"high" numeric NOT NULL,
	"low" numeric NOT NULL,
	"volume" numeric NOT NULL,
	"split_coeff" numeric,
	"divident" numeric,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT current_timestamp NOT NULL,
	"updated_at" timestamp with time zone DEFAULT current_timestamp NOT NULL,
	CONSTRAINT "ticker_quotes_symbol_date_pk" PRIMARY KEY("symbol","date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_data"."stock_news" (
	"id" uuid PRIMARY KEY NOT NULL,
	"symbol" varchar(40) NOT NULL,
	"url" varchar(2048) NOT NULL,
	"status" text NOT NULL,
	"token_size" integer DEFAULT 0 NOT NULL,
	"markdown" text,
	"news_date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT current_timestamp NOT NULL,
	"updated_at" timestamp with time zone DEFAULT current_timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT current_timestamp NOT NULL,
	"updated_at" timestamp with time zone DEFAULT current_timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tickers" (
	"symbol" varchar(40) PRIMARY KEY NOT NULL,
	"type" text,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"figi" varchar(20),
	"about" text,
	"sectors" jsonb DEFAULT '[]'::jsonb,
	"founded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT current_timestamp NOT NULL,
	"updated_at" timestamp with time zone DEFAULT current_timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_tickers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" varchar(40) NOT NULL,
	"amount" numeric NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"open_price" numeric,
	"closed_at" timestamp with time zone,
	"close_price" numeric,
	"created_at" timestamp with time zone DEFAULT current_timestamp NOT NULL,
	"updated_at" timestamp with time zone DEFAULT current_timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_data"."company_profiles" (
	"symbol" varchar(40) PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"currency" varchar(10),
	"sector" text NOT NULL,
	"country" varchar(10) NOT NULL,
	"beta" numeric
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_data"."etf_profiles" (
	"symbol" varchar(40) PRIMARY KEY NOT NULL,
	"sectors" jsonb DEFAULT '[]'::jsonb,
	"holdings" jsonb DEFAULT '[]'::jsonb,
	"inception_date" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_data"."ticker_time_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(40),
	"open_price" numeric NOT NULL,
	"close_price" numeric NOT NULL,
	"high" numeric NOT NULL,
	"low" numeric NOT NULL,
	"volume" numeric NOT NULL,
	"date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255),
	"email" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT current_timestamp NOT NULL,
	"updated_at" timestamp with time zone DEFAULT current_timestamp NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_tickers" ADD CONSTRAINT "user_tickers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_tickers" ADD CONSTRAINT "user_tickers_symbol_tickers_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "public"."tickers"("symbol") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_symbol_url" ON "app_data"."stock_news" USING btree ("symbol","url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_symbol_idx" ON "subscriptions" USING btree ("user_id","symbol");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "symbol_date_index" ON "app_data"."ticker_time_series" USING btree ("symbol","date");
