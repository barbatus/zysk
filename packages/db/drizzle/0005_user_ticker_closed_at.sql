ALTER TABLE "user_tickers" RENAME COLUMN "added_at" TO "opened_at";--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "last_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_tickers" ADD COLUMN "closed_at" timestamp with time zone;