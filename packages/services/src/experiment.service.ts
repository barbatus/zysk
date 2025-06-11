import {
  type DataDatabase,
  type EvaluationDetails,
  type Experiment,
  ExperimentTaskStatus,
  sql,
} from "@zysk/db";
import { inject, injectable } from "inversify";
import { type Kysely } from "kysely";

import { dataDBSymbol } from "./db";
import { type AgentStateService } from "./utils/types";

@injectable()
export class ExperimentService implements AgentStateService<Experiment> {
  constructor(
    @inject(dataDBSymbol) private readonly db: Kysely<DataDatabase>,
  ) {}

  async create(params?: { experimentId?: string }): Promise<Experiment> {
    return this.db
      .insertInto("app_data.experiments")
      .values({
        ...(params?.experimentId && { id: params.experimentId }),
        status: ExperimentTaskStatus.Pending,
        version: 1,
      })
      .onConflict((b) =>
        b.columns(["id"]).doUpdateSet({
          status: ExperimentTaskStatus.Pending,
          version: 1,
          updatedAt: new Date(),
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async get(id: string): Promise<Experiment> {
    return this.db
      .selectFrom("app_data.experiments")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
  }

  async getMany(ids: string[]): Promise<Experiment[]> {
    return this.db
      .selectFrom("app_data.experiments")
      .selectAll()
      .where("id", "in", ids)
      .execute();
  }

  async setStatus(
    id: string,
    modelName: string,
    status: ExperimentTaskStatus,
    response?: string | object,
    details?: EvaluationDetails,
    version?: number,
  ): Promise<void> {
    await this.db
      .updateTable("app_data.experiments")
      .set({
        status,
        modelName,
        ...(typeof response === "string" && { responseText: response }),
        ...(typeof response === "object" && {
          responseJson: sql`(${JSON.stringify(response)}::jsonb)`,
        }),
        ...(details && { details }),
        ...(version && { version }),
        updatedAt: new Date(),
      })
      .where("id", "=", id)
      .execute();
  }

  async setSuccess(
    id: string,
    modelName: string,
    result: string | object,
    details: EvaluationDetails,
    version = 1,
  ): Promise<void> {
    await this.setStatus(
      id,
      modelName,
      ExperimentTaskStatus.Completed,
      result,
      details,
      version,
    );
  }
}
