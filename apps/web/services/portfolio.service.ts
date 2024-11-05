import { type Position } from "@zysk/ts-rest";

import { db } from "#/lib/db";

export class PortfolioService {
  async getPositions(): Promise<Position[]> {
    return db.selectFrom("userTickers").selectAll().execute();
  }
}
