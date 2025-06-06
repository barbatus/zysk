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
    markdown: string;
    newsDate: Date;
    url: string;
  }[];

  constructor(
    params: Omit<NewsBasedExperimentParams<Insights>, "symbol" | "currentDate">,
  ) {
    super(params.state, params.prompt, params.model, params.onHeartbeat);
    this.news = params.news;
  }

  override async mapPromptValues(): Promise<Record<string, string>> {
    return {
      news: this.news
        .map(
          (n) =>
            `# ARTICLE ID: ${n.id}, TITLE: ${n.newsDate.toISOString()}, DATE: ${n.newsDate.toISOString()}, URL: ${n.url}\n${n.markdown}`,
        )
        .join("\n---\n"),
    };
  }

  static override readonly modelKey = ModelKeyEnum.Llama33;

  static override async create(params: {
    news: { id: string; markdown: string; url: string; newsDate: Date }[];
    onHeartbeat?: () => Promise<void>;
  }) {
    const experimentService = resolve(ExperimentService);
    const state = await experimentService.create();
    return new NewsInsightsExtractor({
      state,
      ...params,
      prompt: NewsInsightsExtractorPrompt,
      model: modelsWithFallback[ModelKeyEnum.Llama33]!,
      onHeartbeat: params.onHeartbeat,
    });
  }
}
