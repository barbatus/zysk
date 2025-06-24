import { DataDatabase, NewsInsightInsert } from "@zysk/db";
import { inject, injectable } from "inversify";
import { Kysely } from "kysely";
import { chunk } from "lodash";

import { dataDBSymbol } from "./db";
import { Exact } from "./utils/types";

@injectable()
export class NewsInsightsService {
  constructor(
    @inject(dataDBSymbol) private readonly dataDB: Kysely<DataDatabase>,
  ) {}

  async saveInsights(insights: Exact<NewsInsightInsert, NewsInsightInsert>[]) {
    for (const batch of chunk(insights, 500)) {
      await this.dataDB
        .insertInto("app_data.news_insights")
        .values(batch)
        .execute();
    }
  }
}
