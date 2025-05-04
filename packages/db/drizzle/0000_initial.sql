CREATE TABLE IF NOT EXISTS "current_quotes" (
	"symbol" varchar(40) PRIMARY KEY NOT NULL,
	"price" numeric NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
	CONSTRAINT "ticker_quotes_symbol_date_pk" PRIMARY KEY("symbol","date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tickers" (
	"symbol" varchar(40) PRIMARY KEY NOT NULL,
	"type" text,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"figi" varchar(20),
	"about" text,
	"sectors" jsonb DEFAULT '[]'::jsonb,
	"founded_at" timestamp with time zone
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
	"close_price" numeric
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255),
	"email" varchar(255) NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
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
