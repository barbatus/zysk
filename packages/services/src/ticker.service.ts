import { Database, TickerType } from "@zysk/db";
import { inject, injectable } from "inversify";
import { Kysely, sql } from "kysely";
import { chunk, pick } from "lodash";

import { AlphaVantageService } from "./alpha-vantage.service";
import { appDBSymbol } from "./db";
import { FinnhubService } from "./finnhub.service";

const supportedTickers = [
  "AAPL",
  "TSLA",
  "NVDA",
  "LLY",
  "JPM",
  "UPS",
  "XOM",
  "T",
  "QQQ",
];

@injectable()
export class TickerService {
  constructor(
    @inject(appDBSymbol) private readonly appDB: Kysely<Database>,
    private readonly finnhubService: FinnhubService,
    private readonly alphaVantageService: AlphaVantageService,
  ) {}

  async getSupportedTickers() {
    return this.appDB
      .selectFrom("tickers")
      .select("symbol")
      .where("supported", "=", true)
      .execute()
      .then((r) => r.map((t) => t.symbol));
  }

  async fetchAndSaveQuote(symbol: string) {
    const quote = await this.finnhubService.fetchQuote(symbol);
    await this.appDB
      .insertInto("currentQuotes")
      .values({
        symbol,
        price: quote.c,
      })
      .onConflict((b) =>
        b.columns(["symbol"]).doUpdateSet(() => ({
          price: (eb) => eb.ref("excluded.price"),
          updatedAt: new Date(),
        })),
      )
      .execute();
  }

  async fetchUSTickersFromApiAndSave() {
    const response = (await this.finnhubService.fetchUSTickers([])).filter(
      (r) => r.type === "Common Stock" || r.type === "ETP",
    );
    await Promise.all(
      chunk(response, 1000).map(async (c) => {
        await this.appDB
          .insertInto("tickers")
          .values(
            c.map((r) => ({
              ...pick(r, "symbol", "figi", "currency"),
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
              updatedAt: new Date(),
            })),
          )
          .execute();
      }),
    );
  }

  async fetchAndSaveSectors() {
    const tickers = await this.appDB
      .selectFrom("tickers")
      .select(["symbol", "type"])
      .where("supported", "=", true)
      .execute();

    for (const batch of chunk(tickers, 50)) {
      const stocks = batch.filter((t) => t.type === TickerType.Stock);
      const etfs = batch.filter((t) => t.type === TickerType.ETP);

      const sectors = (
        await Promise.all(
          stocks
            .map((s) =>
              this.alphaVantageService
                .fetchCompanyOverview(s.symbol)
                .then((t) =>
                  t
                    ? {
                        symbol: t.symbol,
                        sectors: [{ name: t.Sector, weight: 1 }],
                      }
                    : undefined,
                ),
            )
            .concat(
              ...etfs.map((e) =>
                this.alphaVantageService
                  .fetchETFProfile(e.symbol)
                  .then((t) =>
                    t ? { symbol: t.symbol, sectors: t.sectors } : undefined,
                  ),
              ),
            ),
        )
      ).filter(Boolean);

      await Promise.all(
        sectors.map((t) =>
          this.appDB
            .updateTable("tickers")
            .set({
              sectors: sql`${JSON.stringify(t.sectors)}::jsonb`,
            })
            .where("symbol", "=", t.symbol)
            .execute(),
        ),
      );
    }
  }

  async updateSupportedTickers() {
    await this.appDB
      .updateTable("tickers")
      .set({ supported: true })
      .where("symbol", "in", supportedTickers)
      .execute();
  }

  async getAllSectors() {
    return this.appDB
      .selectFrom("tickers")
      .select(sql<string>`jsonb_array_elements(sectors)->>'name'`.as("sector"))
      .distinct()
      .where("sectors", "is not", null)
      .where(sql`jsonb_array_length(sectors)`, ">", 0)
      .execute()
      .then((r) => r.map((row) => row.sector));
  }
}
