import { PromptTemplate } from "@langchain/core/prompts";
import { type Experiment, type ExperimentTaskStatus } from "@zysk/db";
import { ExperimentService, getLogger, resolve } from "@zysk/services";

import { type AbstractContainer } from "#/llm/core/base";
import { type AgentExecutionResult } from "#/llm/core/schemas";
import {
  AsyncRetrying,
  retryIfException,
  stopAfterAttempt,
} from "#/utils/async-retrying";

import { ModelKeyEnum } from "../core/enums";
import { modelsWithFallback } from "../models/registry";
import { ParserError } from "./prompts/parsers";

const experimentService = resolve(ExperimentService);

const logger = getLogger();

export abstract class Agent<AResult> {
  abstract arun(
    promptValues: Record<string, string>,
  ): Promise<AgentExecutionResult<AResult>>;
}

export class AgentPrompt<TResult = string> extends PromptTemplate {
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
  private readonly onHeartbeat?: () => Promise<void>;
  private readonly unsubscribeModel?: () => void;

  constructor(
    protected readonly state: TState,
    protected readonly prompt: AgentPrompt<AResult>,
    protected readonly model: AbstractContainer = modelsWithFallback[
      ModelKeyEnum.GptO1
    ]!,
    onHeartbeat?: () => Promise<void>,
  ) {
    super();
    this.onHeartbeat = onHeartbeat;
    if (onHeartbeat) {
      this.unsubscribeModel = this.model.onRetry(onHeartbeat);
    }
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
      for await (const state of new AsyncRetrying<TResult>(
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
      )) {
        if (state.success) {
          return state.response!;
        }
      }
    } catch (error) {
      logger.error(
        {
          name: this.constructor.name,
          error: (error as Error).message,
        },
        `Agent failed`,
      );
      throw error;
    }
    throw new Error("Failed to run agent");
  }

  protected abstract mapPromptValues(): Promise<Record<string, string>>;

  protected abstract setStatus(status: ExperimentTaskStatus): Promise<void>;

  protected async onComplete(): Promise<void> {
    this.unsubscribeModel?.();
  }
}

export class ExperimentAgent<
  AResult = string,
  TResult = string,
> extends StatefulAgent<Experiment, AResult, TResult> {
  static async create<TResult = string>(params: {
    prompt?: AgentPrompt<TResult>;
    model?: AbstractContainer;
    onHeartbeat?: () => Promise<void>;
    [key: string]: unknown;
  }): Promise<object> {
    const state = await experimentService.create();
    if (!params.prompt) {
      throw new Error("Prompt is required");
    }
    return new ExperimentAgent(
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
    await experimentService.setStatus(this.state.id, status);
  }

  async setSuccess(result: AgentExecutionResult<AResult>) {
    await experimentService.setSuccess(
      this.state.id,
      result.response as string | object,
      result.evaluationDetails,
    );
    return result.response as unknown as TResult;
  }
}
