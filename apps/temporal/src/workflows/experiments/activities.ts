import { type StockNews } from "@zysk/db";
import { resolve, TickerNewsService } from "@zysk/services";
import { subDays } from "date-fns";

import {
  PreditionsMergerAgent,
  ShortTermNewsBasedPredictorAgent,
} from "#/llm/agents/market-predictor.agent";
import { type Prediction } from "#/llm/agents/prompts/short-term-prediction.prompt";

const tickerNewsService = resolve(TickerNewsService);

export async function fetchLastWeekNews(params: {
  symbol: string;
  tokesLimit?: number;
  overlapLimit?: number;
}) {
  const { symbol, tokesLimit = 150000, overlapLimit = 20000 } = params;

  const news = await tickerNewsService.getNewsBySymbol(
    symbol,
    subDays(new Date(), 30),
  );
  let count = 0;
  const newsBatches: StockNews[][] = [];
  const currentBatch: StockNews[] = [];

  const addCurrentBatch = () => {
    const prevBatch = newsBatches.length
      ? newsBatches[newsBatches.length - 1]
      : [];
    const overlap: StockNews[] = [];
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

export async function runShortTermMarketPredictionExperiment(params: {
  symbol: string;
  newsIds: string[];
}) {
  const { symbol, newsIds } = params;
  const news = await tickerNewsService.getNewsByNewsIds(newsIds);

  const agent = await ShortTermNewsBasedPredictorAgent.create({
    symbol,
    news: news.map((n) => ({
      ...n,
      date: n.newsDate,
    })),
  });
  return await agent.run();
}

export async function mergePredictions(params: { predictions: Prediction[] }) {
  const { predictions } = params;
  const agent = await PreditionsMergerAgent.create({ predictions });
  await agent.run();
}
