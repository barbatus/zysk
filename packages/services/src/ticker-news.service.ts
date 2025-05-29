import FirecrawlApp, { type FirecrawlError } from "@mendable/firecrawl-js";
import {
  type DataDatabase,
  type StockNewsInsert,
  StockNewsStatus,
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

  async scrapeUrlApi(
    url: string,
    timeoutSeconds = 60,
  ): Promise<{
    url: string;
    markdown: string;
    title?: string;
    description?: string;
  }> {
    return this.app
      .scrapeUrl(url, {
        formats: ["markdown"],
        timeout: timeoutSeconds * 1000,
      })
      .then((r) => {
        if (!r.success || !r.metadata) {
          throw new Error("Failed to scrape URL");
        }
        return {
          url: r.metadata.ogUrl ?? r.url ?? url,
          title: r.metadata.ogTitle,
          description: r.metadata.ogDescription,
          markdown: r.markdown!,
        };
      })
      .catch((e) => {
        const fe = e as FirecrawlError;
        if (
          fe.statusCode === 403 &&
          fe.message.includes("This website is no longer support")
        ) {
          this.logger.warn(
            `[TickerNewsService.scrapeUrl] Website is no longer supported: ${url}`,
          );
          throw new Error("Website is no longer supported");
        }
        if (fe.statusCode === 408) {
          this.logger.warn(
            `[TickerNewsService.scrapeUrl] Request timed out: ${url}`,
          );
          throw new RequestTimeoutError(`Request timed out: ${url}`);
        }
        if (fe.statusCode === 502) {
          this.logger.warn(`[TickerNewsService.scrapeUrl] Bad gateway: ${url}`);
          throw new RequestTimeoutError(`Bad gateway: ${url}`);
        }
        if (fe.statusCode === 429) {
          this.logger.warn(
            {
              e: fe.message,
            },
            `[TickerNewsService.scrapeUrl] Rate limited fetching: ${url}`,
          );
          throw new RateLimitExceededError(fe.message, 60);
        }
        if (fe.message.includes("reading 'status'")) {
          this.logger.warn(
            `[TickerNewsService.scrapeUrl] Error scraping URL: ${url}`,
          );
          throw new RequestTimeoutError(`Error scraping URL: ${url}`);
        }
        this.logger.error(
          {
            error: fe.message,
            statusCode: fe.statusCode,
          },
          `[TickerNewsService.scrapeUrl] Error scraping URL: ${url}`,
        );
        throw e;
      });
  }

  async scrapeUrl(params: { url: string; timeoutSeconds?: number }): Promise<{
    url: string;
    markdown: string;
    title?: string;
    description?: string;
  }> {
    const { url, timeoutSeconds = 60 } = params;
    const article = await this.getArticle(url);
    if (article) {
      return {
        url: article.url,
        markdown: article.markdown!,
        title: article.title,
        description: article.description,
      };
    }
    return this.scrapeUrlApi(url, timeoutSeconds);
  }

  async getTickerNews(
    symbol: string,
    sinceDate: Date,
  ): Promise<{ url: string; title: string; newsDate: Date }[]> {
    return this.finnhubService.getTickerNews({ symbol, sinceDate });
  }

  async getGeneralNews(sinceDate: Date) {
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
    const batchSize = 100;
    for (let i = 0; i < news.length; i += batchSize) {
      const scrapedNews = await Promise.all(
        news.slice(i, i + batchSize).map((n) => this.scrapeUrl({ url: n.url })),
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

  async saveNews<T extends StockNewsInsert>(news: Exact<T, StockNewsInsert>[]) {
    return this.db
      .insertInto("app_data.stock_news")
      .values(news)
      .returningAll()
      .onConflict((oc) =>
        oc.columns(["url", "symbol"]).doUpdateSet((eb) => ({
          markdown: eb.ref("excluded.markdown"),
          tokenSize: eb.ref("excluded.tokenSize"),
          newsDate: eb.ref("excluded.newsDate"),
          title: eb.ref("excluded.title"),
          description: eb.ref("excluded.description"),
          status: StockNewsStatus.Scraped,
          updatedAt: new Date(),
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

  async getNewsSincePerTicker(symbol: string, sinceDate: Date) {
    return this.db
      .selectFrom("app_data.stock_news")
      .select(["url", "newsDate", "status", "title"])
      .where("symbol", "=", symbol)
      .where("newsDate", ">=", sinceDate)
      .where("status", "=", StockNewsStatus.Scraped)
      .orderBy("newsDate", "desc")
      .execute();
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

  async getArticle(url: string) {
    return this.db
      .selectFrom("app_data.stock_news")
      .selectAll()
      .where("url", "=", url)
      .where("status", "=", StockNewsStatus.Scraped)
      .executeTakeFirst();
  }
}
