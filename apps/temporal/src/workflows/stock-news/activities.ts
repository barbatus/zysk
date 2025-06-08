import { activityInfo } from "@temporalio/activity";
import { ApplicationFailure } from "@temporalio/workflow";
import { type StockNewsInsert } from "@zysk/db";
import { StockNewsStatus } from "@zysk/db";
import {
  type Exact,
  getLogger,
  RateLimitExceededError,
  RequestTimeoutError,
  resolve,
  TickerNewsService,
} from "@zysk/services";
import { startOfDay, subDays } from "date-fns";
import { isNil } from "lodash";
// eslint-disable-next-line camelcase
import { encoding_for_model } from "tiktoken";

import { getMaxTokens } from "#/llm/models/registry";
import { NewsInsightsExtractor } from "#/llm/runners/insights-extractor";
import { experimentTasksToTokens } from "../experiments/activities";

async function _fetchTickersToProcess(symbols: string[]) {
  const tickerNewsService = resolve(TickerNewsService);
  const latestNewsDate =
    await tickerNewsService.getLatestNewsDatePerTicker(symbols);
  const weekAgo = subDays(new Date(), 7);
  const startOfDay_ = (date: Date) => startOfDay(date);
  const sinceDates = symbols.map((symbol) =>
    isNil(latestNewsDate[symbol])
      ? { symbol, startDate: startOfDay_(weekAgo) }
      : {
          symbol,
          startDate: startOfDay_(subDays(latestNewsDate[symbol].newsDate, 1)),
        },
  );
  return sinceDates;
}

async function batchNews(params: {
  news: {
    id: string;
    url: string;
    newsDate: Date;
    tokenSize: number;
  }[];
  tokensLimit: number;
  overlapLimit?: number;
}) {
  const { overlapLimit = 10_000, news } = params;
  const tokensLimit = params.tokensLimit;

  let count = 0;
  const newsBatches: (typeof news)[] = [];
  const currentBatch: typeof news = [];

  const addCurrentBatch = () => {
    const prevBatch = newsBatches.length
      ? newsBatches[newsBatches.length - 1]
      : [];
    const overlap: typeof news = [];
    let _count = 0;
    for (const _n of prevBatch) {
      if (_count + _n.tokenSize > overlapLimit) {
        break;
      }
      _count += _n.tokenSize;
      overlap.push(_n);
    }
    newsBatches.push(overlap.concat(currentBatch));
  };

  for (const n of news) {
    if (count + n.tokenSize > tokensLimit - overlapLimit) {
      addCurrentBatch();
      currentBatch.length = 0;
      count = 0;
    }
    currentBatch.push(n);
    count += n.tokenSize;
  }
  if (currentBatch.length > 0) {
    addCurrentBatch();
  }
  return newsBatches;
}

export const stockNewsTasksToTokens = {
  "runNewsInsightsExtractorExperiment": Math.min(200_000,getMaxTokens(NewsInsightsExtractor.modelKey)),
  ...experimentTasksToTokens,
} as const;

export async function fetchNewsForPeriod(params: {
  symbol: string;
  startDate: Date;
  endDate?: Date;
  taskName: keyof typeof stockNewsTasksToTokens;
  overlapLimit?: number;
}) {
  const { symbol, startDate, endDate, ...rest } = params;

  const tickerNewsService = resolve(TickerNewsService);
  const news = (
    await tickerNewsService.getNewsBySymbol(symbol, startDate, endDate)
  );

  return (await batchNews({ news, tokensLimit: stockNewsTasksToTokens[params.taskName], ...rest })).map((batch) =>
    batch.map((n) => n.id),
  );
}

export async function runBatchNews(params: {
  newsIds: string[];
  taskName: keyof typeof stockNewsTasksToTokens;
  overlapLimit?: number;
}) {
  const { newsIds, ...rest } = params;
  const tickerNewsService = resolve(TickerNewsService);
  const news = await tickerNewsService.getNewsByNewsIds(newsIds);
  return (await batchNews({ news, tokensLimit: stockNewsTasksToTokens[params.taskName], ...rest })).map((batch) =>
    batch.map((n) => n.id),
  );
}

export async function runNewsInsightsExtractorExperiment(params: {
  symbol: string;
  newsIds: string[];
}) {
  const { newsIds } = params;
  const tickerNewsService = resolve(TickerNewsService);
  const news = await tickerNewsService.getNewsByNewsIds(newsIds);

  const runner = await NewsInsightsExtractor.create({
    news,
  });
  const result = await runner.run();

  const tokenizer = encoding_for_model("gpt-4o");
  const values = result.map(({newsId, insights}) => {
    return {
      id: newsId,
      insights,
      insightsTokenSize: tokenizer.encode(JSON.stringify(insights)).length,
    };
  });
  tokenizer.free();

  await tickerNewsService.saveNewsInsights(values);

  return result;
}

export async function getNewsToFetchDaily(symbols: string[]) {
  const sinceDates = await _fetchTickersToProcess(symbols);
  return sinceDates;
}

export async function getNewsToFetchWeekly(symbols: string[]) {
  const tickerNewsService = resolve(TickerNewsService);
  const listOfNews = await Promise.all(
    symbols.map((symbol) =>
      tickerNewsService.getNewsSincePerTicker(symbol, subDays(new Date(), 7)),
    ),
  );
  const sinceDates = listOfNews.map((news, index) => ({
    symbol: symbols[index],
    failedNews: news.filter((n) => n.status === StockNewsStatus.Failed),
    sinceDate: news.length > 10 ? subDays(new Date(), 7) : undefined,
  }));
  return sinceDates;
}

export async function fetchTickerNews(
  symbol: string,
  startDate: Date,
  endDate?: Date,
) {
  const tickerNewsService = resolve(TickerNewsService);
  if (symbol === "GENERAL") {
    return tickerNewsService.getGeneralNews(startDate, endDate);
  }
  return tickerNewsService.getTickerNews(symbol, startDate, endDate);
}

export async function scrapeNews(url: string, maxTokens = 5000) {
  const logger = getLogger();
  try {
    const tickerNewsService = resolve(TickerNewsService);
    const result = await tickerNewsService.scrapeUrl({
      url,
      timeoutSeconds: 180,
    });
    const tokenizer = encoding_for_model("gpt-4o");
    const cleanedMarkdown = result.markdown
      .replace(/\[.+\]\(.*?\)/gm, "")
      .replace(/(?:\n\n)+/gm, "\n\n");
    const tokens = tokenizer.encode(cleanedMarkdown);
    // Set limit here to 5000 tokens as sometimes it parses more then needed on
    // pages with infinite scrolling, 5000 is enough to get the main content
    const slicedTokens = tokens.slice(0, maxTokens);
    const slicedMarkdown = new TextDecoder().decode(
      tokenizer.decode(slicedTokens),
    );
    tokenizer.free();
    return {
      ...result,
      markdown: slicedMarkdown,
      url: result.url,
      originalUrl: url,
      tokenSize: slicedTokens.length,
    };
  } catch (ex) {
    logger.error(
      {
        error: (ex as Error).message,
      },
      "Error scraping symbol news",
    );

    const attempt = activityInfo().attempt;
    if (ex instanceof RateLimitExceededError) {
      throw ApplicationFailure.create({
        type: "RateLimitExceeded",
        nonRetryable: false,
        message: ex.message,
        nextRetryDelay: `${Math.pow(2, attempt - 1) * ex.retryInSec}s`,
      });
    }
    if (ex instanceof RequestTimeoutError) {
      throw ApplicationFailure.create({
        type: "RequestTimeout",
        nonRetryable: attempt >= 3,
        message: ex.message,
        nextRetryDelay: `${Math.pow(2, attempt - 1) * 60}s`,
      });
    }
    throw ApplicationFailure.create({
      type: "ScapeError",
      nonRetryable: true,
      message: (ex as Error).message,
      cause: ex as Error,
    });
  }
}

export async function saveNews<T extends StockNewsInsert>(
  news: Exact<T, StockNewsInsert>[],
) {
  const tickerNewsService = resolve(TickerNewsService);
  return tickerNewsService.saveNews(news);
}
