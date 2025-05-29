import { heartbeat } from "@temporalio/activity";
import {
  ExperimentService,
  PredictionService,
  resolve,
  TickerDataService,
  TickerNewsService,
  TickerService,
} from "@zysk/services";
import { startOfDay, subDays } from "date-fns";

import { PredictorAgent } from "#/llm/agents/predictor.agent";
import { type Prediction } from "#/llm/agents/prompts/prediction-parser";
import {
  MarketSentimentPredictor,
  SentimentPredictor,
} from "#/llm/agents/sentiment-predictor.agent";

export async function fetchLastWeekNews(params: {
  symbol: string;
  tokesLimit?: number;
  overlapLimit?: number;
}) {
  const { symbol, tokesLimit = 150000, overlapLimit = 10000 } = params;

  const tickerNewsService = resolve(TickerNewsService);
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
  const tickerDataService = resolve(TickerDataService);
  return tickerDataService.getSymbolTimeSeries(symbol, sinceDate);
}

export async function fetchSymbolNSentimentPredictionExperimentData(params: {
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

export async function runTickerSentimentPredictionExperiment(params: {
  symbol: string;
  newsIds: string[];
  timeSeries: { date: Date; closePrice: number }[];
}) {
  const { symbol, newsIds, timeSeries } = params;
  const tickerNewsService = resolve(TickerNewsService);
  const news = await tickerNewsService.getNewsByNewsIds(newsIds);

  const predictionService = resolve(PredictionService);
  const experimentJson =
    await predictionService.getLastGeneralMarketPrediction();

  const agent = await SentimentPredictor.create({
    symbol,
    news: news.map((n) => ({
      ...n,
      date: n.newsDate,
    })),
    timeSeries,
    marketPrediction: experimentJson,
    onHeartbeat: async () => {
      heartbeat("SentimentPredictor");
    },
  });

  return await agent.run();
}

export async function runMarketSentimentPredictionExperiment(params: {
  newsIds: string[];
}) {
  const { newsIds } = params;
  const tickerNewsService = resolve(TickerNewsService);
  const news = await tickerNewsService.getNewsByNewsIds(newsIds);

  const agent = await MarketSentimentPredictor.create({
    news: news.map((n) => ({
      ...n,
      date: n.newsDate,
    })),
    onHeartbeat: async () => {
      heartbeat("MarketSentimentPredictor");
    },
  });
  return await agent.run();
}

export async function makePredictions(params: {
  symbol: string;
  predictions: Prediction[];
}) {
  const { symbol, predictions } = params;
  const agent = await PredictorAgent.create({
    symbol,
    predictions,
  });
  return await agent.run();
}

export async function getExperiments(experimentIds: string[]) {
  const experimentService = resolve(ExperimentService);
  return experimentService.getMany(experimentIds);
}

export async function getSupportedTickers() {
  const tickerService = resolve(TickerService);
  return tickerService.getSupportedTickers();
}
