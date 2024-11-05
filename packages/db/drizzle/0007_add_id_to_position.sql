ALTER TABLE "user_tickers" DROP CONSTRAINT "user_tickers_user_id_symbol_pk";--> statement-breakpoint
ALTER TABLE "user_tickers" ADD COLUMN "id" uuid PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "user_tickers" ADD CONSTRAINT "user_tickers_user_id_symbol_unique" UNIQUE("user_id","symbol");
