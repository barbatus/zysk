import { auditColumns, validatedStringEnum } from "@zysk/db";
import { jsonb, pgSchema, text, uuid } from "drizzle-orm/pg-core";

export const mySchema = pgSchema("app_data");

export enum ExperimentTaskStatus {
  Pending = "pending",
  Running = "running",
  Completed = "completed",
  Failed = "failed",
}

export interface EvaluationDetails {
  promptTokens: number;
  completionTokens: number;
  successfulRequests: number;
  totalCost: number;
  responseTimeMs;
}

export const experimentsTable = mySchema.table("experiments", {
  id: uuid("id").defaultRandom().primaryKey(),
  responseText: text("response_text"),
  responseJson: jsonb("response_json"),
  details: jsonb("details").$type<EvaluationDetails>().notNull(),
  status: validatedStringEnum("status", ExperimentTaskStatus).notNull(),
  ...auditColumns(),
});
