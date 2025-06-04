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
import { MODEL_TO_MAX_TOKENS } from "#/llm/models/registry";

export async function fetchNewsForPeriod(params: {
  symbol: string;
  startDate: Date;
  endDate?: Date;
  tokesLimit?: number;
  overlapLimit?: number;
}) {
  const { symbol, startDate, endDate, overlapLimit = 10_000 } = params;
  const tokesLimit =
    params.tokesLimit ??
    Math.min(150_000, MODEL_TO_MAX_TOKENS[SentimentPredictor.modelKey]);

  const tickerNewsService = resolve(TickerNewsService);
  const news = await tickerNewsService.getNewsBySymbol(
    symbol,
    startDate,
    endDate,
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

export async function fetchTickerTimeSeries(
  symbol: string,
  startDate: Date = startOfDay(subDays(new Date(), 14)),
  endDate?: Date,
) {
  const tickerDataService = resolve(TickerDataService);
  return tickerDataService.getTickerTimeSeries(symbol, startDate, endDate);
}

export async function fetchSentimentPredictionExperimentData(params: {
  symbol: string;
  startDate: Date;
  endDate: Date;
  tokesLimit?: number;
  overlapLimit?: number;
}) {
  const { symbol, startDate, endDate, tokesLimit, overlapLimit } = params;
  const newsBatchIds = await fetchNewsForPeriod({
    symbol,
    startDate,
    endDate,
    tokesLimit,
    overlapLimit,
  });
  const timeSeries = await fetchTickerTimeSeries(symbol, startDate, endDate);
  return { newsBatchIds, timeSeries };
}

export async function runTickerSentimentPredictionExperiment(params: {
  symbol: string;
  newsIds: string[];
  currentDate: Date;
  timeSeries: { date: Date; closePrice: number }[];
}) {
  const { symbol, newsIds, currentDate, timeSeries } = params;
  const tickerNewsService = resolve(TickerNewsService);
  const news = await tickerNewsService.getNewsByNewsIds(newsIds);

  const predictionService = resolve(PredictionService);
  const experimentJson =
    await predictionService.getLastGeneralMarketPredictionForPeriod(
      currentDate,
    );

  const agent = await SentimentPredictor.create({
    symbol,
    news: news.map((n) => ({
      ...n,
      date: n.newsDate,
    })),
    timeSeries,
    currentDate,
    marketPrediction: experimentJson,
    onHeartbeat: async () => {
      heartbeat("SentimentPredictor");
    },
  });

  return await agent.run();
}

export async function runMarketSentimentPredictionExperiment(params: {
  newsIds: string[];
  currentDate: Date;
}) {
  const { newsIds, currentDate } = params;
  const tickerNewsService = resolve(TickerNewsService);
  const news = await tickerNewsService.getNewsByNewsIds(newsIds);

  const agent = await MarketSentimentPredictor.create({
    news: news.map((n) => ({
      ...n,
      date: n.newsDate,
    })),
    currentDate,
    onHeartbeat: async () => {
      heartbeat("MarketSentimentPredictor");
    },
  });
  return await agent.run();
}

export async function makePredictions(params: {
  symbol: string;
  predictions: Prediction[];
  currentDate: Date;
}) {
  const { symbol, predictions, currentDate } = params;
  const agent = await PredictorAgent.create({
    symbol,
    predictions,
    currentDate,
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
