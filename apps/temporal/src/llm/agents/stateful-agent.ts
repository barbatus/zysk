import { type Experiment, type ExperimentTaskStatus } from "#/db/schema";
import { type AgentExecutionResult } from "#/llm/core/schemas";
import { experimentService } from "#/services/experiment.service";
import { logger } from "#/utils/logger";

import { ModelKeyEnum } from "../core/enums";
import { modelsWithFallback } from "../models/registry";

export abstract class Agent<AResult> {
  abstract arun(
    promptValues: Record<string, string>,
  ): Promise<AgentExecutionResult<AResult>>;
}

export abstract class StatefulAgent<
  TState extends Experiment,
  AResult = string,
  TResult = string,
> extends Agent<AResult> {
  constructor(
    protected readonly state: TState,
    protected readonly model = modelsWithFallback[ModelKeyEnum.GptO1]!,
  ) {
    super();
  }

  static async create<
    TAgent extends StatefulAgent<TState, AResult, TResult>,
    TState extends Experiment = Experiment,
    AResult = string,
    TResult = string,
  >(): Promise<TAgent> {
    throw new Error("Not implemented");
  }

  override arun(
    _promptValues: Record<string, string>,
  ): Promise<AgentExecutionResult<AResult>> {
    return this.model.arun("Some prompt") as Promise<
      AgentExecutionResult<AResult>
    >;
  }

  abstract setSuccess(result: AgentExecutionResult<AResult>): Promise<TResult>;

  async run(): Promise<TResult> {
    const promptValues = await this.mapPromptValues();

    try {
      const result = await this.arun(promptValues);
      return this.setSuccess(result);
    } catch (error) {
      logger.error(
        {
          name: this.constructor.name,
          error,
        },
        `Agent failed`,
      );
      throw error;
    }
  }

  protected abstract mapPromptValues(): Promise<Record<string, string>>;

  protected abstract setStatus(status: ExperimentTaskStatus): Promise<void>;
}

export class ExperimentAgent extends StatefulAgent<Experiment> {
  static override async create<TAgent>(): Promise<TAgent> {
    return new ExperimentAgent(
      await experimentService.create(),
    ) as unknown as TAgent;
  }

  async mapPromptValues(): Promise<Record<string, string>> {
    return {};
  }

  async setStatus(status: ExperimentTaskStatus): Promise<void> {
    await experimentService.setStatus(this.state.id, status);
  }

  async setSuccess(result: AgentExecutionResult<string>) {
    await experimentService.setSuccess(
      this.state.id,
      result.response,
      result.evaluationDetails,
    );
    return result.response;
  }
}
