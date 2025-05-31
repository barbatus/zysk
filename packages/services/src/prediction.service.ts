import { type Database, DataDatabase, PredictionInsert } from "@zysk/db";
import { inject, injectable } from "inversify";
import { type Kysely } from "kysely";

import { appDBSymbol, dataDBSymbol } from "./db";
import { Exact } from "./utils/types";

@injectable()
export class PredictionService {
  constructor(
    @inject(dataDBSymbol) private readonly dataDb: Kysely<DataDatabase>,
    @inject(appDBSymbol) private readonly db: Kysely<Database>,
  ) {}

  async saveSymbolPrediction<T extends PredictionInsert>(
    symbol: string,
    prediction: Omit<Exact<T, PredictionInsert>, "symbol">,
  ) {
    await this.db
      .insertInto("predictions")
      .values({ ...prediction, symbol })
      .execute();
  }

  async getLastGeneralMarketPredictionForPeriod(period: Date) {
    const prediction = await this.db
      .selectFrom("predictions")
      .selectAll()
      .where("symbol", "=", "GENERAL")
      .where("period", "<=", period)
      .orderBy("period", "desc")
      .orderBy("createdAt", "desc")
      .limit(1)
      .executeTakeFirstOrThrow();

    const experiment = await this.dataDb
      .selectFrom("app_data.experiments")
      .selectAll()
      .where("id", "=", prediction.experimentId)
      .executeTakeFirstOrThrow();

    return experiment.responseJson;
  }
}
