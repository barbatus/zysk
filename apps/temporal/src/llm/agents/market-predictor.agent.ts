import { type Experiment } from "#/db/schema";
import { experimentService } from "#/services/experiment.service";

import { ModelKeyEnum } from "../core/enums";
import { modelsWithFallback } from "../models/registry";
import { AgentPrompt, ExperimentAgent } from "./experiment.agent";

export class MarketPredictorAgent extends ExperimentAgent {
  constructor(state: Experiment) {
    const prompt = new AgentPrompt({
      template: `
        You are a stock predicttion expert. Say something about the stock market.
        `,
      inputVariables: [],
    });
    const model = modelsWithFallback[ModelKeyEnum.Gpt4o]!;
    super(state, prompt, model);
  }

  static override async create<TResult = string>() {
    const state = await experimentService.create();
    return new MarketPredictorAgent(state) as ExperimentAgent<TResult>;
  }
}
