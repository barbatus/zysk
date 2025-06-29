import { PromptTemplate } from "@langchain/core/prompts";
import { type Experiment, ExperimentTaskStatus } from "@zysk/db";
import {
  ExperimentService,
  getLogger,
  ModelKeyEnum,
  resolve,
} from "@zysk/services";

import { type AbstractContainer } from "#/llm/core/base";
import { type AgentExecutionResult } from "#/llm/core/schemas";
import {
  AsyncRetrier,
  retryIfException,
  stopAfterAttempt,
} from "#/utils/async-retrier";

import {
  type ModelKeyEnumWithFallback,
  modelsWithFallback,
} from "../models/registry";
import { ParserError } from "./prompts/parsers";

const experimentService = resolve(ExperimentService);

const logger = getLogger();
export class ExperimentPrompt<TResult = string> extends PromptTemplate {
  async parseResponse(response: string): Promise<TResult> {
    if (!this.outputParser) {
      return response as TResult;
    }
    return this.outputParser.parse(response) as Promise<TResult>;
  }
}

export abstract class StatefulModelRunner<
  TState extends Experiment,
  AResult = string,
  TResult = string,
> {
  private readonly onHeartbeat?: () => Promise<void>;
  private readonly unsubscribeModel?: () => void;

  constructor(
    protected readonly state: TState,
    protected readonly prompt: ExperimentPrompt<AResult>,
    protected readonly model: AbstractContainer = modelsWithFallback[
      ModelKeyEnum.GptO1
    ]!,
    onHeartbeat?: () => Promise<void>,
  ) {
    this.onHeartbeat = onHeartbeat;
    if (onHeartbeat) {
      this.unsubscribeModel = this.model.onRetry(onHeartbeat);
    }
  }

  async arun(
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
      const retrier = new AsyncRetrier<TResult>(
        async () => {
          const response = await this.arun(promptValues);
          const result = await this.setSuccess(response);
          await this.onComplete();
          return result;
        },
        retryIfException((error) => error instanceof ParserError),
        {
          stop: stopAfterAttempt(2),
          before: async (beforeState) => {
            if (beforeState.attemptNumber > 1) {
              logger.warn(
                {
                  name: this.constructor.name,
                  attempt: beforeState.attemptNumber,
                  lastError: beforeState.lastError!.message,
                },
                `Retrying due to parser error`,
              );
              await this.onHeartbeat?.();
            }
          },
        },
      );
      return await retrier.try();
    } catch (error) {
      logger.error(
        {
          name: this.constructor.name,
          error: (error as Error).message,
        },
        `Agent failed`,
      );
      await this.setStatus(ExperimentTaskStatus.Failed);
      throw error;
    }
  }

  protected abstract mapPromptValues(): Promise<Record<string, string>>;

  protected abstract setStatus(status: ExperimentTaskStatus): Promise<void>;

  protected async onComplete(): Promise<void> {
    this.unsubscribeModel?.();
  }
}

export class ExperimentRunner<
  AResult = string,
  TResult = string,
> extends StatefulModelRunner<Experiment, AResult, TResult> {
  static readonly modelKey: ModelKeyEnum | ModelKeyEnumWithFallback;

  static async create<TResult = string>(params: {
    prompt?: ExperimentPrompt<TResult>;
    model?: AbstractContainer;
    onHeartbeat?: () => Promise<void>;
    [key: string]: unknown;
  }): Promise<object> {
    const state = await experimentService.create();
    if (!params.prompt) {
      throw new Error("Prompt is required");
    }
    return new ExperimentRunner(
      state,
      params.prompt,
      params.model,
      params.onHeartbeat,
    );
  }

  async mapPromptValues(): Promise<Record<string, string>> {
    return {};
  }

  async setStatus(status: ExperimentTaskStatus): Promise<void> {
    await experimentService.setStatus(this.state.id, this.model.name, status);
  }

  async setSuccess(result: AgentExecutionResult<AResult>) {
    await experimentService.setSuccess(
      this.state.id,
      this.model.id,
      result.response as string | object,
      result.evaluationDetails,
    );
    return result.response as unknown as TResult;
  }
}
