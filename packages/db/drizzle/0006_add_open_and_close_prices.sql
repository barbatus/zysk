ALTER TABLE "quote" RENAME COLUMN "value" TO "open_price";--> statement-breakpoint
ALTER TABLE "rl_quote" RENAME COLUMN "value" TO "price";--> statement-breakpoint
ALTER TABLE "quote" ADD COLUMN "close_price" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "user_tickers" ADD COLUMN "open_price" numeric;--> statement-breakpoint
ALTER TABLE "user_tickers" ADD COLUMN "close_price" numeric;