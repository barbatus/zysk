ALTER TABLE "app_data"."experiments" ADD COLUMN "details" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "app_data"."experiments" ADD COLUMN "status" text NOT NULL;