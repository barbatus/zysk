CREATE TABLE IF NOT EXISTS "sectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"alias" varchar(40),
	"supported" boolean DEFAULT false
);
--> statement-breakpoint
ALTER TABLE "app_data"."company_profiles" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "app_data"."etf_profiles" SET SCHEMA "public";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "symbol_index" ON "sectors" USING btree ("symbol");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "alias_index" ON "sectors" USING btree ("alias");