import {
  type EvaluationDetails,
  type Experiment,
  PredictionEnum,
  type PredictionModel,
} from "@zysk/db";
import { ExperimentService, PredictionService, resolve } from "@zysk/services";

import { type AgentExecutionResult } from "#/llm/core/schemas";

import { ModelKeyEnum } from "../core/enums";
import { modelsWithFallback } from "../models/registry";
import { ExperimentAgent } from "./experiment.agent";
import { type Prediction } from "./prompts/prediction-parser";
import { predictionsMergerPrompt } from "./prompts/predictions-merger.prompt";

const experimentService = resolve(ExperimentService);
const predictionService = resolve(PredictionService);

export class PredictorAgent extends ExperimentAgent<
  Prediction,
  PredictionModel
> {
  private readonly predictions: Prediction[];
  private readonly symbol: string;

  constructor(params: {
    symbol: string;
    state: Experiment;
    predictions: Prediction[];
  }) {
    super(
      params.state,
      predictionsMergerPrompt,
      modelsWithFallback[ModelKeyEnum.GptO3Mini],
    );
    this.predictions = params.predictions;
    this.symbol = params.symbol;
  }

  override async mapPromptValues(): Promise<Record<string, string>> {
    return {
      predictions: this.predictions
        .map((p) => `\`\`\`json\n${JSON.stringify(p, null, 2)}\`\`\``)
        .join("\n"),
    };
  }

  override async arun(
    promptValues: Record<string, string>,
  ): Promise<AgentExecutionResult<Prediction>> {
    if (this.predictions.length === 1) {
      return {
        response: this.predictions[0],
        evaluationDetails: {} as EvaluationDetails,
      };
    }
    return await super.arun(promptValues);
  }

  static override async create(params: {
    symbol: string;
    predictions: Prediction[];
  }) {
    const state = await experimentService.create();
    return new PredictorAgent({
      state,
      ...params,
    });
  }

  override async setSuccess(result: AgentExecutionResult<Prediction>) {
    await experimentService.setSuccess(
      this.state.id,
      result.response as string | object,
      result.evaluationDetails,
      2,
    );
    const finalPrediction = this.evalPrediction(result.response);
    await predictionService.saveSymbolPrediction(this.symbol, finalPrediction);
    return finalPrediction;
  }

  private estimatePrediction(experimentResponse: Prediction): PredictionEnum {
    if (
      experimentResponse.prediction === "fall" &&
      experimentResponse.confidence >= 90
    ) {
      return PredictionEnum.WillFall;
    }

    if (
      experimentResponse.prediction === "grow" &&
      experimentResponse.confidence >= 90
    ) {
      return PredictionEnum.WillGrow;
    }

    if (
      experimentResponse.prediction === "grow" &&
      experimentResponse.confidence >= 80
    ) {
      return PredictionEnum.LikelyGrow;
    }

    if (
      experimentResponse.prediction === "fall" &&
      experimentResponse.confidence >= 80
    ) {
      return PredictionEnum.LikelyFall;
    }

    return PredictionEnum.StayTheSame;
  }

  private evalPrediction(prediction: Prediction) {
    const predictionEnum = this.estimatePrediction(prediction);
    const predictionResponse = {
      ...prediction,
      prediction: predictionEnum,
      insights: prediction.newsInsights,
    };

    return {
      symbol: this.symbol,
      confidence: prediction.confidence,
      responseJson: predictionResponse,
      prediction: predictionEnum,
    };
  }
}
