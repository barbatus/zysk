import { Database, TickerType } from "@zysk/db";
import { inject, injectable } from "inversify";
import { Kysely } from "kysely";
import { chunk, omit } from "lodash";

import { appDBSymbol } from "./db";
import { FinnhubService } from "./finnhub.service";

const supportedTickers = ["AAPL"];

@injectable()
export class TickerService {
  constructor(
    @inject(appDBSymbol) private readonly appDB: Kysely<Database>,
    private readonly finnhubService: FinnhubService,
  ) {}

  async getSupportedTickers() {
    return this.appDB
      .selectFrom("tickers")
      .select("symbol")
      .where("supported", "=", true)
      .execute()
      .then((r) => r.map((t) => t.symbol));
  }

  async getAndSaveQuote(symbol: string) {
    const quote = await this.finnhubService.getQuote(symbol);
    await this.appDB
      .insertInto("currentQuotes")
      .values({
        symbol,
        price: quote.c,
      })
      .onConflict((b) =>
        b.columns(["symbol"]).doUpdateSet(() => ({
          price: (eb) => eb.ref("excluded.price"),
        })),
      )
      .execute();
  }

  async getAndSaveUSTickers() {
    const response = (await this.finnhubService.getUSTickers([])).filter(
      (r) => r.type === "Common Stock" || r.type === "ETP",
    );
    await Promise.all(
      chunk(response, 1000).map(async (c) => {
        await this.appDB
          .insertInto("tickers")
          .values(
            c.map((r) => ({
              ...omit(
                r,
                "description",
                "type",
                "displaySymbol",
                "isin",
                "mic",
                "shareClassFIGI",
                "symbol2",
              ),
              type:
                r.type === "Common Stock" ? TickerType.Stock : TickerType.ETP,
              about: r.description,
              supported: supportedTickers.includes(r.symbol),
            })),
          )
          .onConflict((b) =>
            b.columns(["symbol"]).doUpdateSet(() => ({
              about: (eb) => eb.ref("excluded.about"),
              supported: (eb) => eb.ref("excluded.supported"),
            })),
          )
          .execute();
      }),
    );
  }
}
