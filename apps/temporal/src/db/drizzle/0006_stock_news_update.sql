CREATE TABLE IF NOT EXISTS "app_data"."stock_news" (
	"symbol" varchar(40) NOT NULL,
	"url" varchar(255) NOT NULL,
	"status" text NOT NULL,
	"token_size" integer,
	"markdown" text,
	"news_date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT current_timestamp NOT NULL,
	"updated_at" timestamp with time zone DEFAULT current_timestamp NOT NULL
);
--> statement-breakpoint
DROP TABLE "app_data.stock_news";