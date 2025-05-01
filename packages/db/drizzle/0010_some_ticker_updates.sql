ALTER TABLE "quote" ALTER COLUMN "symbol" SET DATA TYPE varchar(40);--> statement-breakpoint
ALTER TABLE "rl_quote" ALTER COLUMN "symbol" SET DATA TYPE varchar(40);--> statement-breakpoint
ALTER TABLE "ticker" ALTER COLUMN "symbol" SET DATA TYPE varchar(40);--> statement-breakpoint
ALTER TABLE "ticker" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "ticker" ALTER COLUMN "figi" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "ticker" ALTER COLUMN "figi" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ticker" ALTER COLUMN "sectors" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "user_tickers" ALTER COLUMN "symbol" SET DATA TYPE varchar(40);