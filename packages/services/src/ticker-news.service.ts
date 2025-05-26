import FirecrawlApp, { type FirecrawlError } from "@mendable/firecrawl-js";
import {
  type DataDatabase,
  StockNewsStatus,
  type StockNewsUpdate,
} from "@zysk/db";
import { startOfDay } from "date-fns";
import { inject, injectable } from "inversify";
import { type Kysely, NotNull } from "kysely";
import { keyBy } from "lodash";

import { type AppConfig, appConfigSymbol } from "./config";
import { dataDBSymbol } from "./db";
import { FinnhubService } from "./finnhub.service";
import {
  RateLimitExceededError,
  RequestTimeoutError,
} from "./utils/exceptions";
import { type Logger, loggerSymbol } from "./utils/logger";
import { Exact } from "./utils/types";

@injectable()
export class TickerNewsService {
  private readonly app: FirecrawlApp;
  constructor(
    @inject(appConfigSymbol) private readonly appConfig: AppConfig,
    @inject(dataDBSymbol) private readonly db: Kysely<DataDatabase>,
    @inject(loggerSymbol) private readonly logger: Logger,
    private readonly finnhubService: FinnhubService,
  ) {
    this.app = new FirecrawlApp({
      apiKey: this.appConfig.firecrawlApiKey,
    });
  }

  async scrapeUrl(
    url: string,
    timeoutSeconds = 60,
  ): Promise<{ url: string; markdown: string | undefined }> {
    return this.app
      .scrapeUrl(url, {
        formats: ["markdown"],
        timeout: timeoutSeconds * 1000,
        proxy: "stealth",
        waitFor: 5000,
      })
      .then((r) => {
        if (!r.success) {
          throw new Error("Failed to scrape URL");
        }
        return { url: r.url!, markdown: r.markdown };
      })
      .catch((e) => {
        const fe = e as FirecrawlError;
        if (
          fe.statusCode === 403 &&
          fe.message.includes("This website is no longer support")
        ) {
          this.logger.warn(`Website is no longer supported: ${url}`);
          return { url, markdown: undefined };
        }
        if (fe.statusCode === 408) {
          this.logger.warn(`Request timed out: ${url}`);
          throw new RequestTimeoutError();
        }
        if (fe.statusCode === 429) {
          this.logger.warn(
            {
              e: fe.message,
            },
            `Rate limited fetching: ${url}`,
          );
          throw new RateLimitExceededError(fe.message, 60);
        }
        this.logger.error(
          {
            error: fe.message,
            statusCode: fe.statusCode,
          },
          `Error scraping URL: ${url}`,
        );
        throw e;
      });
  }

  async getTickerNews(
    symbol: string,
    sinceDate: Date,
  ): Promise<{ url: string; title: string; newsDate: Date }[]> {
    return this.finnhubService.getTickerNews({ symbol, sinceDate });
  }

  async getGeneralNewsPage(sinceDate: Date) {
    return this.finnhubService.getTickerNews({
      symbol: "general",
      sinceDate,
    });
  }

  // *getNewsSince(
  //   symbol: string,
  //   sinceDate: Date,
  // ): Generator<
  //   Promise<{ url: string; title: string; newsDate: Date }[]>,
  //   void,
  //   { url: string; title: string; newsDate: Date }[]
  // > {
  //   let page = 1;
  //   const news = yield this.getNewsPage(symbol, page);
  //   if (news.length === 0) return;

  //   const filteredNews = news.filter((n) => n.newsDate >= sinceDate);
  //   yield Promise.resolve(filteredNews);

  //   page++;
  // }

  async getTodayNews(symbol: string) {
    return this.getTickerNews(symbol, startOfDay(new Date()));
  }

  async scrapeTodayNews(symbol: string) {
    const news = await this.getTodayNews(symbol);
    const result: {
      url: string;
      markdown: string;
      newsDate: Date;
    }[] = [];
    const dateMap = keyBy(news, "newsUrl");
    // Currently, Firecrawl's RL is 100 requests per minute
    for (let i = 0; i < news.length; i += 100) {
      const scrapedNews = await Promise.all(
        news.slice(i, i + 100).map((n) => this.scrapeUrl(n.url)),
      );
      const data = scrapedNews
        .map((n) =>
          n.markdown
            ? {
                ...n,
                markdown: n.markdown,
                newsDate: dateMap[n.url].newsDate,
              }
            : null,
        )
        .filter(Boolean);
      result.push(...data);
    }
    return result;
  }

  async saveNews<T extends StockNewsUpdate>(news: Exact<T, StockNewsUpdate>[]) {
    return this.db
      .insertInto("app_data.stock_news")
      .values(news)
      .returningAll()
      .onConflict((oc) =>
        oc.columns(["url", "symbol"]).doUpdateSet((eb) => ({
          markdown: eb.ref("excluded.markdown"),
          tokenSize: eb.ref("excluded.tokenSize"),
          newsDate: eb.ref("excluded.newsDate"),
        })),
      )
      .execute();
  }

  async getLatestNewsDatePerTicker(symbols: string[]) {
    const result = await this.db
      .selectFrom("app_data.stock_news")
      .select(["symbol", (eb) => eb.fn.max("newsDate").as("newsDate")])
      .where("symbol", "in", symbols)
      .groupBy("symbol")
      .execute();
    return keyBy(result, "symbol");
  }

  async getNewsBySymbol(symbol: string, sinceDate: Date) {
    return this.db
      .selectFrom("app_data.stock_news")
      .selectAll()
      .where((eb) =>
        eb("symbol", "=", symbol).and(eb("newsDate", ">=", sinceDate)),
      )
      .where("status", "=", StockNewsStatus.Scraped)
      .orderBy("newsDate", "desc")
      .execute();
  }

  async getNewsByNewsIds(newsIds: string[]) {
    return this.db
      .selectFrom("app_data.stock_news")
      .selectAll()
      .where("id", "in", newsIds)
      .where("status", "=", StockNewsStatus.Scraped)
      .$narrowType<{ markdown: NotNull }>()
      .execute();
  }
}
