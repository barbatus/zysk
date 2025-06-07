import { ExperimentService, ModelKeyEnum, resolve } from "@zysk/services";

import { modelsWithFallback } from "../models/registry";
import { ExperimentRunner } from "./experimenter";
import { type NewsBasedExperimentParams } from "./news-based-sentiment-predictor";
import { NewsInsightsExtractorPrompt } from "./prompts/insights-extractor.prompt";
import { type Insights } from "./prompts/insights-parser";

export class NewsInsightsExtractor extends ExperimentRunner<
  Insights,
  Insights
> {
  private readonly news: {
    id: string;
    symbol: string;
    markdown: string;
    newsDate: Date;
    url: string;
  }[];

  constructor(
    params: Omit<NewsBasedExperimentParams<Insights>, "symbol" | "currentDate" | "news"> & {
      news: { id: string; markdown: string; url: string; newsDate: Date; symbol: string }[]
    },
  ) {
    super(params.state, params.prompt, params.model, params.onHeartbeat);
    this.news = params.news;
  }

  override async mapPromptValues(): Promise<Record<string, string>> {
    return {
      news: this.news
        .map(
          (n) =>
            `# ARTICLE FOR SYMBOL: ${n.symbol}, ID: ${n.id}, TITLE: ${n.newsDate.toISOString()}, DATE: ${n.newsDate.toISOString()}, URL: ${n.url}\n${n.markdown}`,
        )
        .join("\n---\n"),
    };
  }

  static override readonly modelKey = ModelKeyEnum.DeepSeekLlama;

  static override async create(params: {
    news: { id: string; markdown: string; url: string; newsDate: Date; symbol: string }[];
    onHeartbeat?: () => Promise<void>;
  }) {
    const experimentService = resolve(ExperimentService);
    const state = await experimentService.create();
    return new NewsInsightsExtractor({
      state,
      ...params,
      prompt: NewsInsightsExtractorPrompt,
      model: modelsWithFallback[ModelKeyEnum.DeepSeekLlama]!,
      onHeartbeat: params.onHeartbeat,
    });
  }
}
