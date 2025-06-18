import { type Experiment, type StockNewsInsight } from "@zysk/db";
import { ExperimentService, ModelKeyEnum, resolve } from "@zysk/services";
import { format } from "date-fns";
// eslint-disable-next-line camelcase
import { encoding_for_model } from "tiktoken";
import { dedent } from "ts-dedent";

import { type AbstractContainer } from "../core/base";
import { modelsWithFallback } from "../models/registry";
import { type ExperimentPrompt, ExperimentRunner } from "./experimenter";
import { type Prediction } from "./prompts/prediction-parser";
import {
  WeeklyGeneralMarketSentimentPredictionPrompt,
  WeeklyTickerSentimentPredictionPrompt,
} from "./prompts/weekly-sentiment-prediction.prompt";

export interface NewsBasedExperimentParams<TResult = Prediction> {
  state: Experiment;
  symbol: string;
  prompt: ExperimentPrompt<TResult>;
  model: AbstractContainer;
  newsInsights: {
    id: string;
    insights: StockNewsInsight[];
    newsDate: Date;
    url: string;
  }[];
  currentDate: Date;
  onHeartbeat?: () => Promise<void>;
}

function formatInsight(n: NewsBasedExperimentParams["newsInsights"][number]) {
  const insightsToMd = (insights: StockNewsInsight[]) => {
    return insights
      .map(
        (i, index) => dedent`
      ### Insight ${index + 1}
       - Insight description: ${i.insight}
       - Impact: ${i.impact}
       - Symbols: ${i.symbols.join(", ")}
       - Sectors: ${i.sectors.join(", ")}
    `,
      )
      .join("\n");
  };

  return `# ARTICLE TITLE: ${n.newsDate.toISOString()}, DATE: ${n.newsDate.toISOString()}, URL: ${n.url}:\n${insightsToMd(n.insights)}`;
}

function mapPromptValues(params: {
  symbol: string;
  newsInsights: NewsBasedExperimentParams["newsInsights"];
  currentDate: Date;
  quotes: { date: Date; closePrice: number }[];
}) {
  const { symbol, newsInsights, currentDate, quotes } = params;

  return {
    symbol,
    news: newsInsights.map(formatInsight).join("\n---\n"),
    currentDate: format(currentDate, "yyyy-MM-dd"),
    quotes: quotes
      .map((t) => `${format(t.date, "yyyy-MM-dd")}: ${t.closePrice}`)
      .join("\n"),
  };
}

export async function splitNewsInsights(params: {
  symbol: string;
  newsInsights: NewsBasedExperimentParams["newsInsights"];
  currentDate: Date;
  tokenLimit: number;
}) {
  const { symbol, currentDate, newsInsights, tokenLimit } = params;

  const values = mapPromptValues({
    symbol,
    newsInsights: [],
    currentDate,
    quotes: [],
  });

  const prompt = await WeeklyTickerSentimentPredictionPrompt.format(values);
  const tokenizer = encoding_for_model("gpt-4o");
  const promptSize = tokenizer.encode(prompt).length;
  const safetyMargin = 500 + promptSize;

  let count = 0;
  const newsBatches: (typeof newsInsights)[] = [];
  let currentBatch: typeof newsInsights = [];

  for (const n of newsInsights) {
    const tokenSize = tokenizer.encode(formatInsight(n)).length;
    if (count + tokenSize + safetyMargin > tokenLimit) {
      newsBatches.push(currentBatch);
      currentBatch = [];
      count = 0;
    }
    currentBatch.push(n);
    count += tokenSize;
  }
  if (currentBatch.length > 0) {
    newsBatches.push(currentBatch);
  }

  tokenizer.free();

  return newsBatches;
}

class NewsBasedSentimentPredictor extends ExperimentRunner<
  Prediction,
  Prediction
> {
  private readonly symbol: string;
  private readonly newsInsights: NewsBasedExperimentParams["newsInsights"];
  private readonly currentDate: Date;

  constructor(params: NewsBasedExperimentParams) {
    super(params.state, params.prompt, params.model, params.onHeartbeat);
    this.symbol = params.symbol;
    this.newsInsights = params.newsInsights;
    this.currentDate = params.currentDate;
  }

  override async mapPromptValues(): Promise<Record<string, string>> {
    return mapPromptValues({
      symbol: this.symbol,
      newsInsights: this.newsInsights,
      currentDate: this.currentDate,
      quotes: [],
    });
  }
}

export class WeeklyTickerSentimentPredictor extends NewsBasedSentimentPredictor {
  private readonly marketPrediction: Experiment["responseJson"];
  private readonly timeSeries: { date: Date; closePrice: number }[];
  static override readonly modelKey = ModelKeyEnum.DeepSeekReasoner;

  constructor(
    params: NewsBasedExperimentParams & {
      marketPrediction: Experiment["responseJson"];
      timeSeries: { date: Date; closePrice: number }[];
    },
  ) {
    super(params);
    this.marketPrediction = params.marketPrediction;
    this.timeSeries = params.timeSeries;
  }

  override async mapPromptValues(): Promise<Record<string, string>> {
    return {
      ...(await super.mapPromptValues()),
      marketPrediction: JSON.stringify(this.marketPrediction),
      quotes: this.timeSeries
        .map((t) => `${format(t.date, "yyyy-MM-dd")}: ${t.closePrice}`)
        .join("\n"),
    };
  }

  static override async create(params: {
    symbol: string;
    newsInsights: NewsBasedExperimentParams["newsInsights"];
    marketPrediction: Experiment["responseJson"];
    timeSeries: { date: Date; closePrice: number }[];
    currentDate: Date;
    experimentId?: string;
    onHeartbeat?: () => Promise<void>;
  }) {
    const experimentService = resolve(ExperimentService);
    const state = await experimentService.create({
      experimentId: params.experimentId,
    });
    return new WeeklyTickerSentimentPredictor({
      state,
      ...params,
      prompt: WeeklyTickerSentimentPredictionPrompt,
      model: modelsWithFallback[this.modelKey]!,
    });
  }
}

export class MarketSentimentPredictor extends ExperimentRunner<
  Prediction,
  Prediction
> {
  static override readonly modelKey = ModelKeyEnum.GptO3Mini;

  static override async create(params: {
    currentDate: Date;
    newsInsights: NewsBasedExperimentParams["newsInsights"];
    onHeartbeat?: () => Promise<void>;
  }) {
    const experimentService = resolve(ExperimentService);
    const state = await experimentService.create();
    return new NewsBasedSentimentPredictor({
      state,
      ...params,
      symbol: "GENERAL",
      prompt: WeeklyGeneralMarketSentimentPredictionPrompt,
      model: modelsWithFallback[this.modelKey]!,
    });
  }
}
