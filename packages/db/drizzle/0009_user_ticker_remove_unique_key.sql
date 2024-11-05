ALTER TABLE "user_tickers" DROP CONSTRAINT "user_tickers_user_id_symbol_unique";--> statement-breakpoint
ALTER TABLE "user_tickers" ALTER COLUMN "amount" SET NOT NULL;