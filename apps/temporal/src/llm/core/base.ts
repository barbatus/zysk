import { type BaseChatModel } from "@langchain/core/language_models/chat_models";
import { type AIMessage } from "@langchain/core/messages";
import { type RunnableConfig } from "@langchain/core/runnables";
import { type Ratelimit } from "@upstash/ratelimit";
import { getConfig, getLogger } from "@zysk/services";
import dedent from "dedent";

import {
  AsyncRetrying,
  type RetryCallState,
  retryIfException,
  stopAfterAttempt,
} from "#/utils/async-retrying";
import { PromptTrimmer } from "#/utils/trimmer";

import {
  type ModelKeyEnum,
  type ModelProviderEnum,
  type ModelVendorEnum,
} from "./enums";
import {
  FatalTimeoutError,
  RateLimitExceededError,
  ResponseTimeoutError,
  shouldRetryException,
} from "./exceptions";
import { type ExecutionResult } from "./schemas";

const appConfig = getConfig();
const logger = getLogger();

export type AnyLLMModelType = BaseChatModel;

export class ModelIdentity {
  constructor(
    public id: string,
    public name: string,
    public vendor: ModelVendorEnum,
    public provider: ModelProviderEnum,
  ) {}

  toString(): string {
    return `ModelIdentity(name=${this.name}, vendor=${this.vendor}, provider=${this.provider})`;
  }
}

/**
 * Interface for running a LLM model.
 * It should take in a prompt and return an ExecutionResult.
 */
export interface AbstractRunner {
  arun: (message: string, config?: RunnableConfig) => Promise<ExecutionResult>;

  onRetry: (handler: () => Promise<void> | void) => () => void;
}

export abstract class BaseLLMRunner implements AbstractRunner {
  protected llm: AnyLLMModelType;

  constructor(llm: AnyLLMModelType) {
    this.llm = llm;
  }

  onRetry(_handler: () => Promise<void> | void): () => void {
    throw new Error("Method not implemented.");
  }

  protected async ainvoke(
    message: string,
    config?: RunnableConfig,
  ): Promise<AIMessage | string> {
    const timeout =
      (config?.metadata?.timeout as number | undefined) ??
      appConfig.llmResponseTimeoutSec;
    try {
      const startTime = Date.now();
      logger.info(`[BaseLLMRunner] running ${this.toString()}`);

      const result = await Promise.race<AIMessage | string>([
        this.llm.invoke(message, config),
        new Promise((_, reject) =>
          // eslint-disable-next-line no-promise-executor-return
          setTimeout(() => {
            reject(new Error("Timeout"));
          }, timeout * 1000),
        ),
      ]);

      const executionTime = (Date.now() - startTime) / 1000;
      logger.info(
        `[BaseLLMRunner] ${this.toString()} execution time: ${executionTime.toFixed(2)}s`,
      );

      return result;
    } catch (error) {
      if ((error as Error).message === "Timeout") {
        throw new Error(
          `[BaseLLMRunner] ${this.toString()} API call timed out after ${timeout}s`,
        );
      }
      throw error;
    }
  }

  abstract arun(
    message: string,
    config?: RunnableConfig,
  ): Promise<ExecutionResult>;

  toString(): string {
    return `BaseLLMRunner(llm=${this.llm.constructor.name})`;
  }
}

/**
 * Interface for a container that holds a LLM model or agent
 */
export interface AbstractContainer extends AbstractRunner {
  readonly id: string;
}

/**
 * A container for a LLM based runner
 */
export class ModelContainer implements AbstractContainer {
  constructor(
    public runner: BaseLLMRunner,
    public identity: ModelIdentity,
  ) {}

  onRetry(_handler: () => Promise<void> | void): () => void {
    throw new Error("Method not implemented.");
  }

  get id(): string {
    return this.identity.id;
  }

  toString(): string {
    return `ModelContainer(name=${this.identity.name}, runner=${this.runner.toString()})`;
  }

  async arun(
    message: string,
    config?: RunnableConfig,
  ): Promise<ExecutionResult> {
    const result = await this.runner.arun(message, config);
    const content = result.response.trim();

    logger.debug(`Response content: [${content}]`);

    if (
      content === "I'm sorry, but I can't assist with that request." ||
      content === "I'm sorry, I can't assist with that request."
    ) {
      throw new Error(
        `Content filter error: ${content} runner=${this.runner.toString()}`,
      );
    } else if (!content) {
      throw new Error(
        `Model response is empty. runner=${this.runner.toString()}`,
      );
    }

    return result;
  }
}

export class SequentialModelContainer implements AbstractRunner {
  private modelContainers: ModelContainer[];
  private currentContainer: ModelContainer;
  private maxInputTokens: number;
  private charsPerToken: number;
  private maxAttempts: number;
  private modelKey: ModelKeyEnum;
  private onRetryHandlers: (() => Promise<void> | void)[] = [];
  private lastRateLimitTTL = 60;
  private rateLimiter: Ratelimit | undefined;

  constructor(
    modelKey: ModelKeyEnum,
    containers: Iterable<ModelContainer>,
    maxInputTokens: number,
    rateLimiter?: Ratelimit,
    charsPerToken = 3,
  ) {
    if (Array.from(containers).length === 0) {
      throw new Error(`Containers must be non-empty for ${modelKey}`);
    }
    this.modelContainers = Array.from(containers);
    this.shuffle(this.modelContainers);
    this.maxInputTokens = maxInputTokens;
    this.charsPerToken = charsPerToken;
    this.maxAttempts = Math.max(3, Math.floor(this.modelContainers.length / 2));
    this.modelKey = modelKey;
    this.currentContainer = this.modelContainers[0];
    this.rateLimiter = rateLimiter;
  }

  private shuffle(array: ModelContainer[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  async adjustPromptLength(prompt: string): Promise<string> {
    const trimmer = new PromptTrimmer(this.maxInputTokens, this.charsPerToken);
    const res = await trimmer.trim(prompt);

    if (res.wasTrimmed) {
      logger.warn(
        {
          originalTokens: res.originalTokens,
          estimatedTokens: res.estimatedTokens,
          maxTokens: this.maxInputTokens,
          chars: res.originalLength,
          truncationPoint: res.truncationPoint,
        },
        `[SequentialModelContainer.arun(${this.modelKey})] Prompt length exceeds limits`,
      );
      return res.trimmedText;
    }

    logger.info(
      {
        originalTokens: res.originalTokens,
        maxTokens: this.maxInputTokens,
        chars: res.originalLength,
      },
      `[SequentialModelContainer.arun(${this.modelKey})] Prompt length is within limits`,
    );
    return prompt;
  }

  get length(): number {
    return this.modelContainers.length;
  }

  get id(): string {
    return this.currentContainer.id;
  }

  toString(): string {
    return dedent`SequentialModelContainer(
      model=${this.modelKey},
      modelContainers=${this.modelContainers
        .map((c) => c.identity.id)
        .join(", ")}
    )`;
  }

  onRetry(handler: () => Promise<void> | void): () => void {
    this.onRetryHandlers.push(handler);

    return () => {
      const index = this.onRetryHandlers.indexOf(handler);
      if (index !== -1) {
        this.onRetryHandlers.splice(index, 1);
      }
    };
  }

  async arun(
    message: string,
    config?: RunnableConfig,
  ): Promise<ExecutionResult> {
    const inputPrompt = await this.adjustPromptLength(message);

    const emitRetry = async (): Promise<void> => {
      for (const handler of this.onRetryHandlers) {
        try {
          await handler();
        } catch (e) {
          logger.error(
            {
              error: e,
            },
            `[SequentialModelContainer(${this.modelKey}).arun] Error in retry event handler`,
          );
        }
      }
    };

    const onBeforeRetry = async (
      details: RetryCallState<ExecutionResult>,
    ): Promise<void> => {
      if (details.attemptNumber <= 1) {
        return;
      }
      await emitRetry();
    };

    let consecutiveTimeouts = 0;
    const callModel = async (attempt: number) => {
      try {
        this.currentContainer = await this.getAvailable(emitRetry, attempt);
        logger.info(
          {
            modelKey: this.modelKey,
            currentContainer: this.currentContainer.toString(),
          },
          `[SequentialModelContainer.arun]`,
        );
        const response = await this.currentContainer.arun(inputPrompt, {
          ...config,
          configurable: {
            ...config?.configurable,
            rateLimiter: this.rateLimiter,
          },
        });
        return response;
      } catch (error) {
        if (error instanceof ResponseTimeoutError) {
          consecutiveTimeouts++;
          if (consecutiveTimeouts >= 2) {
            throw new FatalTimeoutError(
              `[SequentialModelContainer(${this.modelKey}).arun] Multiple consecutive timeout errors occurred.`,
            );
          }
        } else if (error instanceof RateLimitExceededError) {
          this.markRateLimited(this.currentContainer.id, error);
        }
        throw error;
      }
    };
    try {
      for await (const state of new AsyncRetrying(
        callModel,
        retryIfException(shouldRetryException),
        { before: onBeforeRetry, stop: stopAfterAttempt(this.maxAttempts) },
      )) {
        if (state.success) {
          return state.response!;
        }
      }
    } catch (error) {
      logger.error(
        {
          error: (error as Error).message,
          modelKey: this.modelKey,
          currentContainer: this.currentContainer.toString(),
        },
        `[SequentialModelContainer.arun] RetryError`,
      );
      throw error;
    }

    throw new Error("No response received");
  }

  private markRateLimited(
    modelId: string,
    error: RateLimitExceededError,
  ): void {
    logger.warn(`Model ${modelId} is rate limited`);
    this.lastRateLimitTTL = error.retryInSeconds ?? 60;
  }

  private async getAvailable(
    _onRetry: () => Promise<void>,
    attempt: number,
  ): Promise<ModelContainer> {
    logger.info(
      {
        attempt,
        lastRateLimitTTL: this.lastRateLimitTTL,
      },
      `[SequentialModelContainer.getAvailable]`,
    );

    const waitTime =
      attempt > this.modelContainers.length ? this.lastRateLimitTTL * 1000 : 0;

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(
          this.modelContainers[
            Math.floor(Math.random() * this.modelContainers.length)
          ],
        );
      }, waitTime);
    });

    // for (const waitTime of [this.rateLimitTtl, 0]) {
    //   for (const container of this.modelContainers) {
    //     logger.info(
    //       `[SequentialModelContainer(${this.modelKey})] getting available runner=${container.runner.toString()}`,
    //     );
    //     return container;
    //   }

    //   await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
    //   if (onRetry) {
    //     await onRetry();
    //   }
    // }

    // throw new FatalTimeoutError(
    //   `[SequentialModelContainer(${this.modelKey})] not available model containers`,
    // );
  }
}

export class SequentialModelContainerWithFallback implements AbstractContainer {
  private onRetryHandlers: (() => Promise<void> | void)[] = [];

  constructor(
    public modelContainers: SequentialModelContainer[],
    private index = 0,
  ) {}

  get id(): string {
    return this.modelContainers[this.index].id;
  }

  toString(): string {
    return `SequentialModelContainerWithFallback(
      modelContainers=${this.modelContainers
        .map((c) => c.toString())
        .join(", ")}
    )`;
  }

  onRetry(handler: () => Promise<void> | void): () => void {
    const unsubscribeHandlers: (() => void)[] = [];

    for (const container of this.modelContainers) {
      const unsubscribe = container.onRetry(handler);
      unsubscribeHandlers.push(unsubscribe);
      this.onRetryHandlers.push(handler);
    }

    return () => {
      this.onRetryHandlers.length = 0;
      for (const unsubscribeHandler of unsubscribeHandlers) {
        unsubscribeHandler();
      }
    };
  }

  async arun(
    message: string,
    config?: RunnableConfig,
  ): Promise<ExecutionResult> {
    const emitRetry = async (): Promise<void> => {
      for (const handler of this.onRetryHandlers) {
        try {
          await handler();
        } catch (e) {
          logger.error(
            {
              error: e,
            },
            `[SequentialModelContainerWithFallback.arun] Error in retry event handler`,
          );
        }
      }
    };

    for (const container of this.modelContainers) {
      try {
        const response = await container.arun(message, config);
        return response;
      } catch (error) {
        await emitRetry();
        logger.error(
          {
            error: (error as Error).message,
            errorType: (error as Error).constructor.name,
            container: container.toString(),
          },
          `[SequentialModelContainerWithFallback.arun] Container failed`,
        );
        this.index++;
      }
    }

    throw new Error(
      "[SequentialModelContainerWithFallback.arun] No response received from any model container",
    );
  }
}
