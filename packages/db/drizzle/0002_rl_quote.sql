CREATE TABLE IF NOT EXISTS "rl_quote" (
	"symbol" varchar(10) PRIMARY KEY NOT NULL,
	"value" numeric NOT NULL,
	"datetime" timestamp with time zone NOT NULL
);
