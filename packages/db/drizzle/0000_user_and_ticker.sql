CREATE TABLE IF NOT EXISTS "ticker" (
	"symbol" varchar(10) PRIMARY KEY NOT NULL,
	"type" text,
	"currency" varchar(10) NOT NULL,
	"figi" varchar(12) NOT NULL,
	"about" text,
	"sectors" jsonb,
	"founded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_tickers" (
	"user_id" uuid NOT NULL,
	"symbol" varchar(10) NOT NULL,
	"amount" numeric,
	"added_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_tickers_user_id_symbol_pk" PRIMARY KEY("user_id","symbol")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255) NOT NULL,
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
 ALTER TABLE "user_tickers" ADD CONSTRAINT "user_tickers_symbol_ticker_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "public"."ticker"("symbol") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
