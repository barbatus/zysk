import { type StockNewsSentiment, StockNewsStatus } from "@zysk/db";
import {
  NewsInsightsService,
  resolve,
  TickerNewsService,
  TickerService,
} from "@zysk/services";
import { startOfDay, subDays } from "date-fns";
import { isNil, keyBy } from "lodash";

import { getMaxTokens } from "#/llm/models/registry";
import { NewsInsightsExtractor } from "#/llm/runners/insights-extractor";
import { type NewsInsight } from "#/llm/runners/prompts/insights-parser";

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
  const { overlapLimit = 0, news } = params;
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
  // Apparently, extracting insights is hard so making context smaller, otherwise most models run a few minutes.
  runNewsInsightsExtractorExperiment: Math.min(
    32_000,
    getMaxTokens(NewsInsightsExtractor.modelKey),
  ),
} as const;

export async function runBatchNews(params: {
  newsIds: string[];
  taskName: keyof typeof stockNewsTasksToTokens;
  overlapLimit?: number;
}) {
  const { newsIds, ...rest } = params;
  const tickerNewsService = resolve(TickerNewsService);
  const news = await tickerNewsService.getNewsByNewsIds(
    newsIds,
    StockNewsStatus.Scraped,
  );
  return (
    await batchNews({
      news,
      tokensLimit: stockNewsTasksToTokens[params.taskName],
      ...rest,
    })
  ).map((batch) => batch.map((n) => n.id));
}

export async function saveNewsInsights(params: {
  insights: NewsInsight[];
  experimentId: string;
}) {
  const { insights, experimentId } = params;
  const tickerNewsService = resolve(TickerNewsService);
  const newsInsightsService = resolve(NewsInsightsService);

  const insightsWithNewsId = insights.map(({ acticleId, ...rest }) => ({
    ...rest,
    newsId: acticleId,
    impact: rest.impact as StockNewsSentiment,
    insights: rest.insights.map((i) => ({
      ...i,
      sectors: i.sectors.map((s) => s.toUpperCase()),
    })),
    experimentId,
  }));
  const news = keyBy(
    await tickerNewsService.saveNewsInsights(insightsWithNewsId),
    "id",
  );
  const allInsights = insightsWithNewsId
    .map(({ newsId, title: newsTitle, insights: newsInsights }) => {
      return newsInsights.map((i) => ({
        newsId,
        insight: i.insight,
        impact: i.impact as StockNewsSentiment,
        longTerm: i.longTerm,
        refs: {
          symbols: i.symbols,
          sectors: i.sectors,
        },
        newsTitle,
        url: news[newsId].url,
      }));
    })
    .flat();
  await newsInsightsService.saveInsights(allInsights);
}

export async function runNewsInsightsExtractorExperiment(params: {
  newsIds: string[];
  experimentId?: string;
}) {
  const { newsIds, experimentId } = params;
  const tickerNewsService = resolve(TickerNewsService);
  const tickerService = resolve(TickerService);
  const news = await tickerNewsService.getNewsByNewsIds(
    newsIds,
    StockNewsStatus.Scraped,
  );
  const sectors = await tickerService.getSectors();

  const runner = await NewsInsightsExtractor.create({
    news,
    experimentId,
    sectors: sectors.map((s) => s.symbol),
  });
  const result = await runner.run();
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
