ALTER TABLE "predictions" ADD COLUMN "experiment_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "predictions" ADD CONSTRAINT "predictions_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "app_data"."experiments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
