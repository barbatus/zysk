import FirecrawlApp, { type FirecrawlError } from "@mendable/firecrawl-js";
import { type DataDatabase, type InsertableStockNews } from "@zysk/db";
import axios, { type AxiosError } from "axios";
import { startOfDay } from "date-fns";
import { inject, injectable } from "inversify";
import { type Kysely } from "kysely";
import { keyBy, omit } from "lodash";

import { type AppConfig, appConfigSymbol } from "./config";
import { dbSymbol } from "./db";
import { type Logger, loggerSymbol } from "./utils/logger";

@injectable()
export class TickerNewsService {
  private readonly app: FirecrawlApp;
  constructor(
    @inject(appConfigSymbol) private readonly appConfig: AppConfig,
    @inject(dbSymbol) private readonly db: Kysely<DataDatabase>,
    @inject(loggerSymbol) private readonly logger: Logger,
  ) {
    this.app = new FirecrawlApp({
      apiKey: this.appConfig.firecrawlApiKey,
    });
  }

  async scrapeUrl(
    url: string,
  ): Promise<{ url: string; markdown: string | undefined }> {
    return this.app
      .scrapeUrl(url, {
        formats: ["markdown"],
      })
      .then((r) => {
        if (!r.success) {
          throw new Error("Failed to scrape URL");
        }
        return { url, markdown: r.markdown };
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
          return { url, markdown: undefined };
        }
        this.logger.error(`Error scraping URL: ${url}`, e);
        throw e;
      });
  }

  async getNewsPage(symbol: string, page: number) {
    return axios
      .get<{
        data: {
          news_url: string;
          date: string;
          title: string;
        }[];
      }>("https://stocknewsapi.com/api/v1", {
        params: {
          tickers: symbol,
          items: 10,
          token: this.appConfig.stockNewsApiKey,
          page,
        },
      })
      .then(({ data }) =>
        data.data.map((n) => ({
          ...omit(n, "news_url", "date"),
          url: n.news_url,
          newsDate: new Date(n.date),
        })),
      )
      .catch((e) => {
        if (
          (e as AxiosError<{ message?: string }>).response?.status === 403 &&
          (
            e as AxiosError<{ message?: string }>
          ).response?.data.message?.includes(
            "Basic plans can query up to 5 pages",
          )
        ) {
          return [] as { url: string; title: string; newsDate: Date }[];
        }
        throw e;
      });
  }

  *getNewsSince(
    symbol: string,
    sinceDate: Date,
  ): Generator<
    Promise<{ url: string; title: string; newsDate: Date }[]>,
    void,
    { url: string; title: string; newsDate: Date }[]
  > {
    let page = 1;
    const news = yield this.getNewsPage(symbol, page);
    if (news.length === 0) return;

    const filteredNews = news.filter((n) => n.newsDate >= sinceDate);
    yield Promise.resolve(filteredNews);

    page++;
  }

  async getAllNews(symbol: string) {
    // Basic supports only 5 pages
    const pages = Array.from({ length: 5 }).map((_, page) => {
      return this.getNewsPage(symbol, page);
    });
    const news = await Promise.all(pages);
    return news.flat();
  }

  async getTodayNews(symbol: string) {
    // 100 URLs is usually enough for a day
    const news = await this.getNewsPage(symbol, 1);
    return news.filter((n) => {
      const date = new Date(n.newsDate);
      return date >= startOfDay(new Date());
    });
  }

  async scrapeTodayNews(symbol: string) {
    const news = await this.getTodayNews(symbol);
    const result: { url: string; markdown: string; newsDate: Date }[] = [];
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

  async saveNews(news: InsertableStockNews[]) {
    return this.db
      .insertInto("app_data.stock_news")
      .values(news)
      .returningAll()
      .onConflict((oc) =>
        oc.columns(["url", "symbol"]).doUpdateSet({
          markdown: (eb) => eb.ref("excluded.markdown"),
          tokenSize: (eb) => eb.ref("excluded.tokenSize"),
          newsDate: (eb) => eb.ref("excluded.newsDate"),
        }),
      )
      .execute();
  }

  async getLatestNewsDatePerTicker() {
    const result = await this.db
      .selectFrom("app_data.stock_news")
      .select(["symbol", (eb) => eb.fn.max("newsDate").as("newsDate")])
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
      .orderBy("newsDate", "desc")
      .execute();
  }

  async getNewsByNewsIds(newsIds: string[]) {
    return this.db
      .selectFrom("app_data.stock_news")
      .selectAll()
      .where("id", "in", newsIds)
      .execute();
  }
}

// export const tickerNewsService = new TickerNewsService();
