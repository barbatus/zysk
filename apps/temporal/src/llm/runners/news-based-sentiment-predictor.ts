import { type Experiment, StockNewsInsight } from "@zysk/db";
import { ExperimentService, ModelKeyEnum, resolve } from "@zysk/services";
import { format } from "date-fns";

import { type AbstractContainer } from "../core/base";
import { modelsWithFallback } from "../models/registry";
import { type ExperimentPrompt, ExperimentRunner } from "./experimenter";
import { type Prediction } from "./prompts/prediction-parser";
import {
  GeneralMarketSentimentPredictionPrompt,
  TickerSentimentPredictionPrompt,
} from "./prompts/sentiment-prediction.prompt";
import { dedent } from "ts-dedent";

export interface NewsBasedExperimentParams<TResult = Prediction> {
  state: Experiment;
  symbol: string;
  prompt: ExperimentPrompt<TResult>;
  model: AbstractContainer;
  newsInsights: { id: string; insights: StockNewsInsight[]; newsDate: Date; url: string }[];
  currentDate: Date;
  onHeartbeat?: () => Promise<void>;
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
    const insightsToMd = (insights: StockNewsInsight[]) => {
      return insights.map((i, index) => dedent`
        ### Insight ${index + 1}
         - Insight description: ${i.insight}
         - Impact: ${i.impact}
         - Symbols: ${i.symbols.join(", ")}
         - Sectors: ${i.sectors.join(", ")}
      `).join("\n");
    };

    return {
      symbol: this.symbol,
      news: this.newsInsights
        .map(
          (n) =>
            `# ARTICLE TITLE: ${n.newsDate.toISOString()}, DATE: ${n.newsDate.toISOString()}, URL: ${n.url}:\n${insightsToMd(n.insights)}`,
        )
        .join("\n---\n"),
      currentDate: format(this.currentDate, "yyyy-MM-dd"),
    };
  }
}

export class TickerSentimentPredictor extends NewsBasedSentimentPredictor {
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
    onHeartbeat?: () => Promise<void>;
  }) {
    const experimentService = resolve(ExperimentService);
    const state = await experimentService.create();
    return new TickerSentimentPredictor({
      state,
      ...params,
      prompt: TickerSentimentPredictionPrompt,
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
      prompt: GeneralMarketSentimentPredictionPrompt,
      model: modelsWithFallback[this.modelKey]!,
    });
  }
}
