import FirecrawlApp, { type FirecrawlError } from "@mendable/firecrawl-js";
import {
  type DataDatabase,
  type StockNewsInsert,
  StockNewsInsight,
  StockNewsSentiment,
  StockNewsStatus,
} from "@zysk/db";
import axios, { AxiosError } from "axios";
import axiosRetry from "axios-retry";
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

const apiWithRetry = axios.create();
axiosRetry(apiWithRetry, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay.bind(axiosRetry),
  retryCondition: (err) =>
    axiosRetry.isNetworkOrIdempotentRequestError(err) ||
    err.response?.statusText === "ECONNREFUSED",
});

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

  private async scrapeUrlsViaBotasaurus(params: {
    urls: string[];
    useProxy?: boolean;
    convertToMd?: boolean;
    waitFor?: number;
    timeout?: number;
    onPoll?: () => void;
  }): Promise<
    {
      url: string;
      content?: string;
      error?: Error;
      title?: string;
      description?: string;
    }[]
  > {
    const { urls, onPoll } = params;
    const data = urls.map((link) => ({
      data: {
        link,
        use_proxy: params.useProxy,
        convert_to_md: params.convertToMd,
        wait_for: params.waitFor,
        timeout: params.timeout,
      },
      scraper_name: "scrape_md",
    }));
    const tasks = await apiWithRetry.post<
      [
        {
          id: string;
        },
      ]
    >("http://localhost:8000/api/tasks/create-task-async", data);

    const taskIds = tasks.data.map((task) => task.id);

    const results = await this.pollUntilCondition<
      {
        results?: {
          url: string;
          markdown: string;
          status: number;
          title?: string;
          description?: string;
        }[];
        task: {
          id: string;
          status: "completed" | "failed" | "pending" | "in_progress";
        };
      }[]
    >({
      url: `http://localhost:8000/api/ui/tasks/results`,
      body: {
        task_ids: taskIds,
        filters: {},
        page: 1,
        per_page: 100,
      },
      timeout: 300_000 * taskIds.length,
      condition: (response) => {
        return (
          response.data.every((r) => r.task.status === "completed") ||
          response.data.some((r) => r.task.status === "failed")
        );
      },
      onPoll,
    });

    return results.map((r, index) => {
      const result = r.results?.[0];
      if (r.task.status === "failed" || !result || result.status !== 200) {
        return {
          url: urls[index],
          error: result
            ? new Error(result.markdown)
            : new Error("Failed to scrape URL"),
        };
      }
      return {
        url: result.url,
        content: result.markdown,
      };
    });
  }

  protected async scrapeUrlViaApi(
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

  async scrapeUrls(params: {
    urls: string[];
    useProxy?: boolean;
    convertToMd?: boolean;
    waitFor?: number;
    timeoutSeconds?: number;
    onPoll?: () => void;
  }): Promise<
    {
      url: string;
      error?: Error;
      content?: string;
      title?: string;
      description?: string;
      onPoll?: () => void;
    }[]
  > {
    return this.scrapeUrlsViaBotasaurus(params);
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

  async getTodayNews(symbol: string) {
    return this.getTickerNews(symbol, startOfDay(new Date()));
  }

  async scrapeTodayNews(symbol: string) {
    const news = await this.getTodayNews(symbol);
    const result: {
      url: string;
      content: string;
      newsDate: Date;
    }[] = [];
    const dateMap = keyBy(news, "newsUrl");
    // Currently, Firecrawl's RL is 100 requests per minute
    const batchSize = 100;
    for (let i = 0; i < news.length; i += batchSize) {
      const scrapedNews = await this.scrapeUrls({
        urls: news.slice(i, i + batchSize).map((n) => n.url),
      });
      const data = scrapedNews
        .map((n) =>
          n.content
            ? {
                ...n,
                content: n.content,
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
        oc.columns(["url"]).doUpdateSet((eb) => ({
          markdown: eb.ref("excluded.markdown"),
          tokenSize: eb.ref("excluded.tokenSize"),
          newsDate: eb.ref("excluded.newsDate"),
          title: eb.ref("excluded.title"),
          description: eb.ref("excluded.description"),
          status: eb.ref("excluded.status"),
          source: eb.ref("excluded.source"),
          updatedAt: new Date(),
        })),
      )
      .execute();
  }

  async saveNewsInsights<
    T extends {
      newsId: string;
      impact?: StockNewsSentiment;
      title: string;
      description: string;
      mainSymbol?: string;
      extractedSymbols: string[];
      insights: StockNewsInsight[];
      experimentId: string;
      newsDate?: Date;
    },
  >(
    newsInsights: Exact<
      T,
      {
        newsId: string;
        impact?: StockNewsSentiment;
        title: string;
        description: string;
        mainSymbol?: string;
        extractedSymbols: string[];
        insights: StockNewsInsight[];
        experimentId: string;
        newsDate?: Date;
      }
    >[],
  ) {
    const mapCols = (update: T) => {
      return [
        sql<string>`${update.newsId}::uuid`.as("id"),
        sql<StockNewsInsight[]>`(${JSON.stringify(update.insights)}::jsonb)`.as(
          "insights",
        ),
        sql<StockNewsSentiment>`${update.impact}`.as("impact"),
        sql<string>`${update.title}`.as("title"),
        sql<string>`${update.description}`.as("description"),
        sql<string[]>`(${JSON.stringify(update.extractedSymbols)}::jsonb)`.as(
          "extractedSymbols",
        ),
        sql<string>`${JSON.stringify(update.mainSymbol)}`.as("mainSymbol"),
        sql<string>`${update.experimentId}::uuid`.as("experiementId"),
        sql<StockNewsStatus>`${StockNewsStatus.InsightsExtracted}`.as("status"),
        sql<Date | null>`${update.newsDate ? String(update.newsDate) : "NULL"}::timestamp with time zone`.as(
          "newsDate",
        ),
      ];
    };

    const query = this.db
      .updateTable("app_data.stock_news")
      .from(
        newsInsights
          .slice(1)
          .reduce(
            (qb, update) => {
              return qb.union(this.db.selectNoFrom(mapCols(update)));
            },
            this.db.selectNoFrom(mapCols(newsInsights[0])),
          )
          .as("data_table"),
      )
      .set((eb) => ({
        insights: sql`COALESCE(${eb.ref("app_data.stock_news.insights")}, '[]'::jsonb) || ${eb.ref("data_table.insights")}`,
        title: eb.ref("data_table.title"),
        description: eb.ref("data_table.description"),
        impact: eb.ref("data_table.impact"),
        extractedSymbols: sql`${eb.ref("app_data.stock_news.extractedSymbols")} || ${eb.ref("data_table.extractedSymbols")}`,
        status: eb.ref("data_table.status"),
        mainSymbol: sql<
          string | null
        >`COALESCE(${eb.ref("app_data.stock_news.mainSymbol")}, ${eb.ref("data_table.mainSymbol")})`,
        experiementId: eb.ref("data_table.experiementId"),
        updatedAt: new Date(),
        newsDate: sql<Date>`COALESCE(${eb.ref("app_data.stock_news.newsDate")}, ${eb.ref("data_table.newsDate")})`,
      }))
      .whereRef("app_data.stock_news.id", "=", "data_table.id")
      .returningAll();
    return query.execute();
  }

  async getLatestNewsDatePerTicker(symbols: string[]) {
    const result = await this.db
      .selectFrom("app_data.stock_news")
      .select(["mainSymbol", (eb) => eb.fn.max("newsDate").as("newsDate")])
      .where("mainSymbol", "in", symbols)
      .groupBy("mainSymbol")
      .execute();
    return keyBy(result, "mainSymbol");
  }

  async getNewsSincePerTicker(symbol: string, sinceDate: Date) {
    return this.db
      .selectFrom("app_data.stock_news")
      .select(["url", "newsDate", "status", "title"])
      .where("mainSymbol", "=", symbol)
      .where("newsDate", ">=", sinceDate)
      .where("status", "=", StockNewsStatus.Scraped)
      .orderBy("newsDate", "desc")
      .execute();
  }

  async getNewsBySymbol(symbol: string, startDate: Date, endDate?: Date) {
    const symbolFilter = sql<boolean>`${sql.ref("extracted_symbols")} @> ${sql.lit(
      JSON.stringify([symbol]),
    )}::jsonb`;

    return this.db
      .selectFrom("app_data.stock_news")
      .select([
        "id",
        "url",
        "newsDate",
        "status",
        "title",
        "tokenSize",
        "insights",
      ])
      .where((eb) => eb.or([symbolFilter]))
      .where("newsDate", ">=", startDate)
      .$if(Boolean(endDate), (eb) => eb.where("newsDate", "<", endDate!))
      .where("status", "=", StockNewsStatus.Scraped)
      .orderBy("newsDate", "desc")
      .execute();
  }

  async getNewsByInsightsSymbol(
    symbol: string,
    startDate: Date,
    endDate?: Date,
  ) {
    const symbolFilter = sql<boolean>`${sql.ref("insights")} @> ${sql.lit(
      JSON.stringify([{ symbols: [symbol] }]),
    )}::jsonb`;
    const sectorFilter = sql<boolean>`${sql.ref("insights")} @> ${sql.lit(
      JSON.stringify([{ sectors: [symbol] }]),
    )}::jsonb`;
    return this.db
      .selectFrom("app_data.stock_news")
      .select([
        "id",
        "url",
        "newsDate",
        "status",
        "title",
        "tokenSize",
        "insights",
      ])
      .where((eb) => eb.or([symbolFilter, sectorFilter]))
      .where("newsDate", ">=", startDate)
      .$if(Boolean(endDate), (eb) => eb.where("newsDate", "<", endDate!))
      .where("status", "=", StockNewsStatus.InsightsExtracted)
      .orderBy("newsDate", "desc")
      .execute();
  }

  async getNewsByNewsIds(newsIds: string[], status: StockNewsStatus) {
    return newsIds.length > 0
      ? this.db
          .selectFrom("app_data.stock_news")
          .selectAll()
          .where("id", "in", newsIds)
          .where("status", "=", status)
          .$narrowType<{ markdown: NotNull }>()
          .execute()
      : Promise.resolve([]);
  }

  async getScrappedArticles(urls: string[]) {
    return this.db
      .selectFrom("app_data.stock_news")
      .selectAll()
      .where((eb) =>
        eb.or([eb("url", "in", urls), eb("originalUrl", "in", urls)]),
      )
      .where("status", "in", [
        StockNewsStatus.Scraped,
        StockNewsStatus.InsightsExtracted,
      ])
      .$narrowType<{ markdown: NotNull }>()
      .execute();
  }

  async saveNewsSources(
    sources: {
      name: string;
      url: string;
      supported?: boolean;
    }[],
  ) {
    return await this.db
      .insertInto("app_data.news_sources")
      .values(
        sources.map((source) => ({
          name: source.name,
          url: source.url,
          settings: sql`${JSON.stringify({ supported: source.supported ?? false })}::jsonb`,
        })),
      )
      .onConflict((oc) =>
        oc.columns(["url"]).doUpdateSet((eb) => ({
          name: eb.ref("excluded.name"),
          url: eb.ref("excluded.url"),
          settings: sql`COALESCE(${eb.ref("app_data.news_sources.settings")}, '{}'::jsonb) || ${eb.ref("excluded.settings")}`,
        })),
      )
      .execute();
  }

  async getNewsSources() {
    return this.db
      .selectFrom("app_data.news_sources")
      .selectAll()
      .where(sql`settings->>'supported'`, "=", "true")
      .execute();
  }

  private async pollUntilCondition<T>({
    url,
    condition,
    body,
    interval = 10000,
    timeout = 600_000,
    onPoll,
  }: {
    url: string;
    body?: Record<string, unknown>;
    condition: (response: { data: T }) => boolean;
    interval?: number;
    timeout?: number;
    onPoll?: () => void;
  }): Promise<T> {
    const startTime = Date.now();

    while (true) {
      onPoll?.();

      const response = await axios.post<T>(url, body).catch(() => {
        return null;
      });

      if (response && condition(response)) {
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
