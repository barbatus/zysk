import {
  type DataDatabase,
  type EvaluationDetails,
  type Experiment,
  ExperimentTaskStatus,
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

  async create(): Promise<Experiment> {
    return this.db
      .insertInto("app_data.experiments")
      .values({
        status: ExperimentTaskStatus.Pending,
        version: 1,
      })
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
    status: ExperimentTaskStatus,
    response?: string | object,
    details?: EvaluationDetails,
    version?: number,
  ): Promise<void> {
    await this.db
      .updateTable("app_data.experiments")
      .set({
        status,
        ...(typeof response === "string" && { responseText: response }),
        ...(typeof response === "object" && { responseJson: response }),
        ...(details && { details }),
        ...(version && { version }),
      })
      .where("id", "=", id)
      .execute();
  }

  async setSuccess(
    id: string,
    result: string | object,
    details: EvaluationDetails,
    version = 1,
  ): Promise<void> {
    await this.setStatus(
      id,
      ExperimentTaskStatus.Completed,
      result,
      details,
      version,
    );
  }
}
