ALTER TABLE "rl_quote" RENAME COLUMN "datetime" TO "updated_at";--> statement-breakpoint
ALTER TABLE "rl_quote" ALTER COLUMN "updated_at" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "rl_quote" ALTER COLUMN "updated_at" SET DEFAULT now();