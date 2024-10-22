CREATE TABLE IF NOT EXISTS "quote" (
	"symbol" varchar(10) NOT NULL,
	"value" numeric NOT NULL,
	"high" numeric NOT NULL,
	"low" numeric NOT NULL,
	"volume" numeric NOT NULL,
	"split_coeff" numeric,
	"divident" numeric,
	"date" date NOT NULL,
	CONSTRAINT "quote_symbol_date_pk" PRIMARY KEY("symbol","date")
);
