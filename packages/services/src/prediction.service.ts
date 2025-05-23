import { type Database, PredictionModel } from "@zysk/db";
import { inject, injectable } from "inversify";
import { type Kysely } from "kysely";

import { dataDBSymbol } from "./db";

@injectable()
export class PredictionService {
  constructor(@inject(dataDBSymbol) private readonly db: Kysely<Database>) {}

  async saveSymbolPrediction(
    symbol: string,
    prediction: Omit<PredictionModel, "symbol">,
  ) {
    await this.db
      .insertInto("predictions")
      .values({ ...prediction, symbol })
      .execute();
  }

  async getLastGeneralMarketPrediction() {
    return this.db
      .selectFrom("predictions")
      .selectAll()
      .where("symbol", "=", "GENERAL")
      .orderBy("createdAt", "desc")
      .limit(1)
      .executeTakeFirst();
  }
}
