CREATE TABLE IF NOT EXISTS "predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(255) NOT NULL,
	"prediction" text NOT NULL,
	"confidence" numeric NOT NULL,
	"response_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT current_timestamp NOT NULL,
	"updated_at" timestamp with time zone DEFAULT current_timestamp NOT NULL
);
