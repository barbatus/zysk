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

import { getMaxTokens } from "#/llm/models/registry";
import {
  MarketSentimentPredictor,
  TickerSentimentPredictor,
} from "#/llm/runners/news-based-sentiment-predictor";
import { type Prediction } from "#/llm/runners/prompts/prediction-parser";
import { SentimentPredictor } from "#/llm/runners/sentiment-predictor";

export async function fetchTickerTimeSeries(
  symbol: string,
  startDate: Date = startOfDay(subDays(new Date(), 14)),
  endDate?: Date,
) {
  const tickerDataService = resolve(TickerDataService);
  return tickerDataService.getTickerTimeSeries(symbol, startDate, endDate);
}

export const experimentTasksToTokens = {
  runTickerSentimentPredictionExperiment: getMaxTokens(
    TickerSentimentPredictor.modelKey,
  ),
  runMarketSentimentPredictionExperiment: getMaxTokens(
    MarketSentimentPredictor.modelKey,
  ),
} as const;

async function batchNewsInsights(params: {
  insights: {
    id: string;
    insightsTokenSize: number;
  }[];
  tokensLimit: number;
  safetyMargin?: number;
}) {
  const { insights, tokensLimit, safetyMargin = 0 } = params;

  let count = 0;
  const newsBatches: (typeof insights)[] = [];
  let currentBatch: typeof insights = [];

  for (const n of insights) {
    if (count + n.insightsTokenSize > tokensLimit - safetyMargin) {
      newsBatches.push(currentBatch);
      currentBatch = [];
      count = 0;
    }
    currentBatch.push(n);
    count += n.insightsTokenSize;
  }
  if (currentBatch.length > 0) {
    newsBatches.push(currentBatch);
  }
  return newsBatches;
}

export async function fetchNewsInsightsForPeriod(params: {
  symbol: string;
  startDate: Date;
  endDate?: Date;
  taskName: keyof typeof experimentTasksToTokens;
  overlapLimit?: number;
}) {
  const { symbol, startDate, endDate, ...rest } = params;

  const tickerNewsService = resolve(TickerNewsService);
  const insights = await tickerNewsService.getNewsBySymbol(
    symbol,
    startDate,
    endDate,
  );
  const filteredInsights = insights.filter((n) =>
    n.insights.find(
      (i) => i.sectors.includes(symbol) || i.symbols.includes(symbol),
    ),
  );

  return (
    await batchNewsInsights({
      insights: filteredInsights,
      safetyMargin: 1000,
      tokensLimit: experimentTasksToTokens[params.taskName],
      ...rest,
    })
  ).map((batch) => batch.map((n) => n.id));
}

export async function fetchSentimentPredictionExperimentData(params: {
  symbol: string;
  startDate: Date;
  endDate: Date;
  taskName: keyof typeof experimentTasksToTokens;
  overlapLimit?: number;
}) {
  const { symbol, startDate, endDate, overlapLimit } = params;
  const newsBatchIds = await fetchNewsInsightsForPeriod({
    symbol,
    startDate,
    endDate,
    taskName: params.taskName,
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
  experimentId?: string;
}) {
  const { symbol, newsIds, currentDate, timeSeries, experimentId } = params;
  const tickerNewsService = resolve(TickerNewsService);
  const newsInsights = await tickerNewsService.getNewsByNewsIds(newsIds);

  const predictionService = resolve(PredictionService);
  const experimentJson =
    await predictionService.getLastGeneralMarketPredictionForPeriod(
      currentDate,
    );

  const predictor = await TickerSentimentPredictor.create({
    symbol,
    newsInsights,
    timeSeries,
    currentDate,
    marketPrediction: experimentJson,
    experimentId,
    onHeartbeat: async () => {
      heartbeat("SentimentPredictor");
    },
  });

  return await predictor.run();
}

export async function runMarketSentimentPredictionExperiment(params: {
  newsIds: string[];
  currentDate: Date;
}) {
  const { newsIds, currentDate } = params;
  const tickerNewsService = resolve(TickerNewsService);
  const newsInsights = await tickerNewsService.getNewsByNewsIds(newsIds);

  const agent = await MarketSentimentPredictor.create({
    newsInsights,
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
  experimentId?: string;
}) {
  const { symbol, predictions, currentDate, experimentId } = params;
  const agent = await SentimentPredictor.create({
    symbol,
    predictions,
    currentDate,
    experimentId,
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
