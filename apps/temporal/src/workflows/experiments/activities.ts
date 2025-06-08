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

import { fetchNewsForPeriod } from "../stock-news/activities";

export async function fetchTickerTimeSeries(
  symbol: string,
  startDate: Date = startOfDay(subDays(new Date(), 14)),
  endDate?: Date,
) {
  const tickerDataService = resolve(TickerDataService);
  return tickerDataService.getTickerTimeSeries(symbol, startDate, endDate);
}

export const experimentTasksToTokens = {
  "runTickerSentimentPredictionExperiment": getMaxTokens(TickerSentimentPredictor.modelKey),
  "runMarketSentimentPredictionExperiment": getMaxTokens(MarketSentimentPredictor.modelKey),
} as const;

export async function fetchSentimentPredictionExperimentData(params: {
  symbol: string;
  startDate: Date;
  endDate: Date;
  taskName: keyof typeof experimentTasksToTokens;
  overlapLimit?: number;
}) {
  const { symbol, startDate, endDate, overlapLimit } = params;
  const newsBatchIds = await fetchNewsForPeriod({
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
}) {
  const { symbol, newsIds, currentDate, timeSeries } = params;
  const tickerNewsService = resolve(TickerNewsService);
  const news = await tickerNewsService.getNewsByNewsIds(newsIds);

  const predictionService = resolve(PredictionService);
  const experimentJson =
    await predictionService.getLastGeneralMarketPredictionForPeriod(
      currentDate,
    );

  const agent = await TickerSentimentPredictor.create({
    symbol,
    news,
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
    news,
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
  const agent = await SentimentPredictor.create({
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
