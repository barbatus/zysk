import { type BaseOutputParser } from "@langchain/core/output_parsers";
import {
  PromptTemplate,
  type PromptTemplateInput,
} from "@langchain/core/prompts";

import { type Experiment, type ExperimentTaskStatus } from "#/db/schema";
import { type AbstractContainer } from "#/llm/core/base";
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

export class AgentPrompt<
  TResult = string,
  RunInput extends Record<string, unknown> = Record<string, unknown>,
  PartialVariableName extends string = string,
> extends PromptTemplate {
  constructor(
    params: PromptTemplateInput<RunInput, PartialVariableName>,
    outputParser?: BaseOutputParser<TResult>,
  ) {
    super({
      ...params,
      outputParser,
    });
  }

  async parseResponse(response: string): Promise<TResult> {
    if (!this.outputParser) {
      return response as TResult;
    }
    return this.outputParser.parse(response) as Promise<TResult>;
  }
}

export abstract class StatefulAgent<
  TState extends Experiment,
  AResult = string,
  TResult = string,
> extends Agent<AResult> {
  constructor(
    protected readonly state: TState,
    protected readonly prompt: AgentPrompt<AResult>,
    protected readonly model: AbstractContainer = modelsWithFallback[
      ModelKeyEnum.GptO1
    ]!,
  ) {
    super();
  }

  override async arun(
    promptValues: Record<string, string>,
  ): Promise<AgentExecutionResult<AResult>> {
    const promptString = await this.prompt.format(promptValues);

    const result = await this.model.arun(promptString);

    return {
      response: await this.prompt.parseResponse(result.response),
      evaluationDetails: result.evaluationDetails,
    };
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

export class ExperimentAgent<TResult = string> extends StatefulAgent<
  Experiment,
  TResult,
  TResult
> {
  static async create<TResult = string>(params: {
    prompt: AgentPrompt<TResult>;
    model?: AbstractContainer;
  }): Promise<ExperimentAgent<TResult>> {
    const state = await experimentService.create();
    return new ExperimentAgent(state, params.prompt, params.model);
  }

  async mapPromptValues(): Promise<Record<string, string>> {
    return {};
  }

  async setStatus(status: ExperimentTaskStatus): Promise<void> {
    await experimentService.setStatus(this.state.id, status);
  }

  async setSuccess(result: AgentExecutionResult<TResult>) {
    await experimentService.setSuccess(
      this.state.id,
      result.response as string | object,
      result.evaluationDetails,
    );
    return result.response;
  }
}
