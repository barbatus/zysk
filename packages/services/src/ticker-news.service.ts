import FirecrawlApp, { type FirecrawlError } from "@mendable/firecrawl-js";
import {
  type DataDatabase,
  type StockNewsInsert,
  StockNewsInsight,
  StockNewsStatus,
} from "@zysk/db";
import axios, { AxiosError } from "axios";
import { startOfDay } from "date-fns";
import { inject, injectable } from "inversify";
import { type Kysely, NotNull, sql } from "kysely";
import { keyBy } from "lodash";

import { AppConfig, appConfigSymbol } from "./config";
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
  private readonly firecrawlApp: FirecrawlApp;
  constructor(
    @inject(appConfigSymbol) private readonly appConfig: AppConfig,
    @inject(dataDBSymbol) private readonly db: Kysely<DataDatabase>,
    @inject(loggerSymbol) private readonly logger: Logger,
    private readonly finnhubService: FinnhubService,
  ) {
    this.firecrawlApp = new FirecrawlApp({
      apiUrl: "http://localhost:3002",
      apiKey: this.appConfig.firecrawlApiKey,
    });
  }

  async scrapeViaFirecrawl(
    url: string,
    timeoutSeconds = 60,
  ): Promise<{
    url: string;
    markdown: string;
    title?: string;
    description?: string;
  }> {
    return this.firecrawlApp
      .scrapeUrl(url, {
        formats: ["markdown"],
        timeout: timeoutSeconds * 1000,
        waitFor: 2000,
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

  private async scrapeUrlViaApi(
    url: string,
    _timeoutSeconds?: number,
  ): Promise<{
    url: string;
    markdown: string;
    title?: string;
    description?: string;
  }> {
    const job = await axios.post<{
      jobId: string;
    }>("http://localhost:3002/v1/scrape", {
      url,
      useProxy: true,
    });

    try {
      const result = await this.pollUntilCondition<{
        status: "completed" | "failed" | "pending";
        returnValue?: {
          url: string;
          content: string;
        };
      }>({
        url: `http://localhost:3002/v1/job/${job.data.jobId}`,
        condition: (response) =>
          response.data.status === "completed" ||
          response.data.status === "failed",
      });

      if (result.status === "failed") {
        throw new Error("Failed to scrape URL");
      }

      return {
        url: result.returnValue!.url,
        markdown: result.returnValue!.content,
      };
    } catch (error) {
      if (
        error instanceof AxiosError &&
        (error.response?.status === 401 ||
          error.response?.status === 403 ||
          error.response?.status === 408)
      ) {
        throw new RequestTimeoutError(
          `Error scraping URL ${url}: ${error.message}`,
        );
      }
      throw error;
    }
  }

  async scrapeUrl(params: { url: string; timeoutSeconds?: number }): Promise<{
    url: string;
    markdown: string;
    title?: string;
    description?: string;
  }> {
    const { url, timeoutSeconds } = params;
    const articles = await this.getArticles([url]);
    if (articles.length === 1) {
      return {
        url: articles[0].url,
        markdown: articles[0].markdown,
        title: articles[0].title,
        description: articles[0].description,
      };
    }
    return this.scrapeUrlViaApi(url, timeoutSeconds);
  }

  async getTickerNews(
    symbol: string,
    startDate: Date,
    endDate?: Date,
  ): Promise<{ url: string; title: string; newsDate: Date }[]> {
    return this.finnhubService.fetchTickerNews({ symbol, startDate, endDate });
  }

  async getGeneralNews(startDate: Date, endDate?: Date) {
    return this.finnhubService.fetchTickerNews({
      symbol: "general",
      startDate,
      endDate,
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
          status: eb.ref("excluded.status"),
          updatedAt: new Date(),
        })),
      )
      .execute();
  }

  async saveNewsInsights<
    T extends {
      id: string;
      insightsTokenSize: number;
      insights: StockNewsInsight[];
    },
  >(
    newsInsights: Exact<
      T,
      {
        id: string;
        insightsTokenSize: number;
        insights: StockNewsInsight[];
      }
    >[],
  ) {
    const query = this.db
      .updateTable("app_data.stock_news")
      .from(
        newsInsights
          .slice(1)
          .reduce(
            (qb, update) => {
              return qb.union(
                this.db.selectNoFrom([
                  sql<string>`${update.id}::uuid`.as("id"),
                  sql<
                    StockNewsInsight[]
                  >`(${JSON.stringify(update.insights)}::jsonb)`.as("insights"),
                  sql<number>`${update.insightsTokenSize}::integer`.as(
                    "insightsTokenSize",
                  ),
                ]),
              );
            },
            this.db.selectNoFrom([
              sql<string>`${newsInsights[0].id}::uuid`.as("id"),
              sql<
                StockNewsInsight[]
              >`(${JSON.stringify(newsInsights[0].insights)}::jsonb)`.as(
                "insights",
              ),
              sql<number>`${newsInsights[0].insightsTokenSize}::integer`.as(
                "insightsTokenSize",
              ),
            ]),
          )
          .as("data_table"),
      )
      .set((eb) => ({
        insights: sql`COALESCE(${eb.ref("app_data.stock_news.insights")}, '[]'::jsonb) || ${eb.ref("data_table.insights")}`,
        insightsTokenSize: eb.ref("data_table.insightsTokenSize"),
        updatedAt: new Date(),
      }))
      .whereRef("app_data.stock_news.id", "=", "data_table.id");
    return query.execute();
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

  async getNewsBySymbol(symbol: string, startDate: Date, endDate?: Date) {
    return this.db
      .selectFrom("app_data.stock_news")
      .select([
        "id",
        "url",
        "newsDate",
        "status",
        "title",
        "tokenSize",
        "insightsTokenSize",
        "insights",
      ])
      .where("symbol", "=", symbol)
      .where("newsDate", ">=", startDate)
      .$if(Boolean(endDate), (eb) => eb.where("newsDate", "<", endDate!))
      .where("status", "=", StockNewsStatus.Scraped)
      .orderBy("newsDate", "desc")
      .execute();
  }

  async getNewsByNewsIds(newsIds: string[]) {
    return newsIds.length > 0
      ? this.db
          .selectFrom("app_data.stock_news")
          .selectAll()
          .where("id", "in", newsIds)
          .where("status", "=", StockNewsStatus.Scraped)
          .$narrowType<{ markdown: NotNull }>()
          .execute()
      : Promise.resolve([]);
  }

  async getArticles(urls: string[]) {
    return this.db
      .selectFrom("app_data.stock_news")
      .selectAll()
      .where((eb) =>
        eb.or([eb("url", "in", urls), eb("originalUrl", "in", urls)]),
      )
      .where("status", "=", StockNewsStatus.Scraped)
      .$narrowType<{ markdown: NotNull }>()
      .execute();
  }

  private async pollUntilCondition<T>({
    url,
    condition,
    interval = 10000,
    timeout = 600_000,
  }: {
    url: string;
    condition: (response: { data: T }) => boolean;
    interval?: number;
    timeout?: number;
  }): Promise<T> {
    const startTime = Date.now();

    while (true) {
      const response = await axios.get<T>(url);

      if (condition(response)) {
        return response.data;
      }

      if (Date.now() - startTime > timeout) {
        throw new Error(`Polling timed out after ${timeout}ms`);
      }

      await new Promise((resolve) => {
        setTimeout(resolve, interval);
      });
    }
  }
}
