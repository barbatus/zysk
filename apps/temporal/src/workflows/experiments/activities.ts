import {
  PredictionService,
  resolve,
  TickerDataService,
  TickerNewsService,
  TickerService,
} from "@zysk/services";
import { startOfDay, subDays } from "date-fns";

import {
  NextWeekMarketPredictionAgent,
  NextWeekNewsBasedPredictorAgent,
} from "#/llm/agents/news-based-predictor.agent";
import { PredictorAgent } from "#/llm/agents/predictor.agent";
import { type Prediction } from "#/llm/agents/prompts/prediction-parser";

const tickerNewsService = resolve(TickerNewsService);
const predictionService = resolve(PredictionService);
const tickerService = resolve(TickerService);
const tickerDataService = resolve(TickerDataService);

export async function fetchLastWeekNews(params: {
  symbol: string;
  tokesLimit?: number;
  overlapLimit?: number;
}) {
  const { symbol, tokesLimit = 150000, overlapLimit = 20000 } = params;

  const news = await tickerNewsService.getNewsBySymbol(
    symbol,
    subDays(new Date(), 7),
  );
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
    if (count + n.tokenSize > tokesLimit - overlapLimit) {
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
  return newsBatches.map((batch) => batch.map((n) => n.id));
}

export async function fetchSymbolTimeSeries(
  symbol: string,
  sinceDate: Date = startOfDay(subDays(new Date(), 14)),
) {
  return tickerDataService.getSymbolTimeSeries(symbol, sinceDate);
}

export async function fetchSymbolNextWeekPredictionExperimentData(params: {
  symbol: string;
  tokesLimit?: number;
  overlapLimit?: number;
}) {
  const { symbol, tokesLimit, overlapLimit } = params;
  const newsBatchIds = await fetchLastWeekNews({
    symbol,
    tokesLimit,
    overlapLimit,
  });
  const timeSeries = await fetchSymbolTimeSeries(symbol);
  return { newsBatchIds, timeSeries };
}

export async function runNextWeekTickerPredictionExperiment(params: {
  symbol: string;
  newsIds: string[];
  timeSeries: { date: Date; closePrice: number }[];
}) {
  const { symbol, newsIds, timeSeries } = params;
  const news = await tickerNewsService.getNewsByNewsIds(newsIds);

  const marketPrediction =
    await predictionService.getLastGeneralMarketPrediction();

  if (!marketPrediction) {
    throw new Error("No market prediction found");
  }

  const agent = await NextWeekNewsBasedPredictorAgent.create({
    symbol,
    news: news.map((n) => ({
      ...n,
      date: n.newsDate,
    })),
    timeSeries,
    marketPrediction: marketPrediction.responseJson,
  });

  return await agent.run();
}

export async function runNextWeekMarketPredictionExperiment(params: {
  newsIds: string[];
}) {
  const { newsIds } = params;
  const news = await tickerNewsService.getNewsByNewsIds(newsIds);

  const agent = await NextWeekMarketPredictionAgent.create({
    news: news.map((n) => ({
      ...n,
      date: n.newsDate,
    })),
  });
  return await agent.run();
}

export async function makePredictions(params: {
  symbol: string;
  predictions: Prediction[];
}) {
  const { symbol, predictions } = params;
  const agent = await PredictorAgent.create({ symbol, predictions });
  return await agent.run();
}

export async function getSupportedTickers() {
  return tickerService.getSupportedTickers();
}
