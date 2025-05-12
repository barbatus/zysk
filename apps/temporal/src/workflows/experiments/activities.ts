import { subDays } from "date-fns";

import { MarketPredictorAgent } from "#/llm/agents/market-predictor.agent";
import { tickerNewsService } from "#/services/ticker-news.service";

export async function runPredictionExperiment(symbol: string) {
  const news = await tickerNewsService.getNews(symbol, subDays(new Date(), 7));

  const agent = await MarketPredictorAgent.create({
    symbol,
    news: news.map((n) => ({
      ...n,
      date: n.newsDate,
    })),
  });
  return await agent.run();
}
