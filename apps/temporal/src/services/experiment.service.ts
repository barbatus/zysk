import { db } from "../db";
import {
  type EvaluationDetails,
  type Experiment,
  ExperimentTaskStatus,
} from "../db/schema";
import { type StateService } from "./types";

export class ExperimentService implements StateService<Experiment> {
  async create(): Promise<Experiment> {
    return db
      .insertInto("app_data.experiments")
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async load(id: string): Promise<Experiment> {
    return db
      .selectFrom("app_data.experiments")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
  }

  async setStatus(
    id: string,
    status: ExperimentTaskStatus,
    response?: string | object,
    details?: EvaluationDetails,
  ): Promise<void> {
    await db
      .updateTable("app_data.experiments")
      .set({
        status,
        ...(typeof response === "string" && { responseText: response }),
        ...(typeof response === "object" && { responseJson: response }),
        ...(details && { details }),
      })
      .where("id", "=", id)
      .execute();
  }

  async setSuccess(
    id: string,
    result: string | object,
    details: EvaluationDetails,
  ): Promise<void> {
    await this.setStatus(id, ExperimentTaskStatus.Completed, result, details);
  }
}

export const experimentService = new ExperimentService();
