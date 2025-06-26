import { heartbeat } from "@temporalio/activity";
import { PredictionType } from "@zysk/db";
import {
  ExperimentService,
  getLogger,
  PredictionService,
  resolve,
  TickerDataService,
  TickerNewsService,
  TickerService,
} from "@zysk/services";
import { addDays, format, startOfDay, subDays } from "date-fns";
import { chunk, groupBy, keyBy, mapValues } from "lodash";

import { getMaxTokens } from "#/llm/models/registry";
import {
  MarketSentimentPredictor,
  splitNewsInsights,
  WeeklyTickerSentimentPredictor,
} from "#/llm/runners/news-based-sentiment-predictor";
import { type Prediction } from "#/llm/runners/prompts/prediction-parser";
import { SentimentPredictor } from "#/llm/runners/sentiment-predictor";

import { fetchAndSaveTickerQuotes } from "../ticker-data/activities";

const logger = getLogger();

export async function fetchTickerTimeSeries(
  symbol: string,
  startDate: Date = startOfDay(subDays(new Date(), 14)),
  endDate?: Date,
) {
  const tickerDataService = resolve(TickerDataService);
  return tickerDataService.getTickerTimeSeries({
    symbols: [symbol],
    startDate,
    endDate,
  });
}

export const experimentTasksToTokens = {
  runTickerSentimentPredictionExperiment: getMaxTokens(
    WeeklyTickerSentimentPredictor.modelKey,
  ),
  runMarketSentimentPredictionExperiment: getMaxTokens(
    MarketSentimentPredictor.modelKey,
  ),
} as const;

export async function fetchNewsInsightsForPeriod(params: {
  symbol: string;
  startDate: Date;
  endDate?: Date;
  taskName: keyof typeof experimentTasksToTokens;
  overlapLimit?: number;
}) {
  const { symbol, startDate, endDate } = params;
  const tokenLimit = experimentTasksToTokens[params.taskName];

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
    await splitNewsInsights({
      symbol,
      newsInsights: filteredInsights,
      currentDate: startDate,
      tokenLimit,
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
  const { symbol, startDate, endDate, overlapLimit, taskName } = params;
  const newsBatchIds = await fetchNewsInsightsForPeriod({
    symbol,
    startDate,
    endDate,
    taskName,
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

  const predictor = await WeeklyTickerSentimentPredictor.create({
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

  const runner = await MarketSentimentPredictor.create({
    newsInsights,
    currentDate,
    onHeartbeat: async () => {
      heartbeat("MarketSentimentPredictor");
    },
  });
  return await runner.run();
}

export async function makePredictions(params: {
  symbol: string;
  predictions: Prediction[];
  currentDate: Date;
  experimentId?: string;
}) {
  const { symbol, predictions, currentDate, experimentId } = params;
  const predictor = await SentimentPredictor.create({
    symbol,
    predictions,
    currentDate,
    experimentId,
  });
  return await predictor.run();
}

export async function getExperiments(experimentIds: string[]) {
  const experimentService = resolve(ExperimentService);
  return experimentService.getMany(experimentIds);
}

export async function getSupportedTickers() {
  const tickerService = resolve(TickerService);
  return tickerService.getSupportedTickers();
}

export async function syncQuotesForPredictions() {
  const predictionService = resolve(PredictionService);
  const predictions = (
    await predictionService.getPredictionsToEvaluate()
  ).toSorted((a, b) => a.period.getTime() - b.period.getTime());

  if (predictions.length === 0) {
    return [];
  }

  const predictionsBySymbol = groupBy(predictions, "symbol");

  const periodsToSync = Object.entries(predictionsBySymbol)
    .map(([symbol, values]) => {
      if (values.length === 0) {
        return undefined;
      }

      const sortedPredictions = values.toSorted(
        (a, b) => a.period.getTime() - b.period.getTime(),
      );

      const startDate = sortedPredictions[0].period;
      const endDate = addDays(
        sortedPredictions[sortedPredictions.length - 1].period,
        7,
      );

      return {
        symbol,
        startDate,
        endDate,
      };
    })
    .filter(Boolean);

  for (const batch of chunk(periodsToSync, 20)) {
    await Promise.all(
      batch.map(({ symbol, startDate, endDate }) =>
        fetchAndSaveTickerQuotes(symbol, startDate, endDate),
      ),
    );
  }

  return periodsToSync;
}

export async function evaluatePredictions(symbols: string[]) {
  const predictionService = resolve(PredictionService);
  const predictions = (
    await predictionService.getPredictionsToEvaluate(symbols)
  ).toSorted((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  if (predictions.length === 0) {
    return;
  }

  const startDate = predictions[0].period;
  const endDate = addDays(predictions[predictions.length - 1].period, 7);

  const tickerDataService = resolve(TickerDataService);
  const result = await tickerDataService.getWeeklyOpenClosePrices(
    symbols,
    startDate,
    endDate,
  );
  const weeklyOpenClosePrices = mapValues(
    groupBy(
      result.map((p) => ({
        weekStart: format(p.weekStart, "yyyy-MM-dd"),
        symbol: p.symbol,
        open: p.open,
        close: p.close,
      })),
      "symbol",
    ),
    (records) => keyBy(records, "weekStart"),
  );

  const quotes = (
    await tickerDataService.getTickerTimeSeries({
      symbols,
      startDate,
      endDate,
    })
  ).map((q) => ({
    symbol: q.symbol,
    date: format(q.date, "yyyy-MM-dd"),
    close: q.closePrice,
    open: q.openPrice,
  }));

  const quotesByDate = mapValues(groupBy(quotes, "date"), (records) =>
    keyBy(records, "symbol"),
  );

  const dailyPredictions = predictions.filter(
    (p) => p.type === PredictionType.Daily,
  );
  const dailyPredictionsWithPrices = dailyPredictions.filter((p) => {
    const date = format(p.period, "yyyy-MM-dd");
    return date in quotesByDate[p.symbol];
  });

  const weeklyPredictions = predictions.filter(
    (p) => p.type === PredictionType.Weekly,
  );
  const weeklyPredictionsWithPrices = weeklyPredictions.filter((p) => {
    const weekStart = format(p.period, "yyyy-MM-dd");
    return weekStart in weeklyOpenClosePrices[p.symbol];
  });

  const weeklyEvaluations = weeklyPredictionsWithPrices
    .map((p) => {
      const weekStart = format(p.period, "yyyy-MM-dd");
      const record = weeklyOpenClosePrices[p.symbol][weekStart];
      return {
        id: p.id,
        evaluation: Number(
          (((record.close - record.open) / record.open) * 100).toFixed(2),
        ),
      };
    })
    .filter(Boolean);

  if (weeklyEvaluations.length) {
    await predictionService.updatePredictionEvaluation(weeklyEvaluations);
  }

  if (weeklyPredictionsWithPrices.length !== weeklyPredictions.length) {
    logger.warn(
      `Not all weekly predictions have been evaluated due quotes absent for ${symbols.join(", ")}`,
    );
  }

  const dailyEvaluations = dailyPredictionsWithPrices
    .map((p) => {
      const date = format(p.period, "yyyy-MM-dd");
      const record = quotesByDate[p.symbol][date];
      return {
        id: p.id,
        evaluation: Number(
          (((record.close - record.open) / record.open) * 100).toFixed(2),
        ),
      };
    })
    .filter(Boolean);

  if (dailyEvaluations.length) {
    await predictionService.updatePredictionEvaluation(dailyEvaluations);
  }

  if (dailyPredictionsWithPrices.length !== dailyPredictions.length) {
    logger.warn(
      `Not all daily predictions have been evaluated due quotes absent for ${symbols.join(", ")}`,
    );
  }
}
