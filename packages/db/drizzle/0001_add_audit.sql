ALTER TABLE "current_quotes" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "current_quotes" ALTER COLUMN "updated_at" SET DEFAULT current_timestamp;--> statement-breakpoint
ALTER TABLE "current_quotes" ADD COLUMN "created_at" timestamp with time zone DEFAULT current_timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "ticker_quotes" ADD COLUMN "created_at" timestamp with time zone DEFAULT current_timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "ticker_quotes" ADD COLUMN "updated_at" timestamp with time zone DEFAULT current_timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "user_tickers" ADD COLUMN "created_at" timestamp with time zone DEFAULT current_timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "user_tickers" ADD COLUMN "updated_at" timestamp with time zone DEFAULT current_timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "created_at" timestamp with time zone DEFAULT current_timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp with time zone DEFAULT current_timestamp NOT NULL;
ALTER TABLE "tickers" ADD COLUMN "created_at" timestamp with time zone DEFAULT current_timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "tickers" ADD COLUMN "updated_at" timestamp with time zone DEFAULT current_timestamp NOT NULL;
