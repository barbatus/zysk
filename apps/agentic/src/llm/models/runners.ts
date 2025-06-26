import { UpstashRatelimitHandler } from "@langchain/community/callbacks/handlers/upstash_ratelimit";
import { AIMessage } from "@langchain/core/messages";
import { type RunnableConfig } from "@langchain/core/runnables";
import { type Ratelimit } from "@upstash/ratelimit";
import { getConfig } from "@zysk/services";
import { type APIError } from "openai";

import { BaseLLMRunner } from "../core/base";
import { type ExecutionResult } from "../core/schemas";
import { CostCallbackHandler, wrapLLMError } from "./callbacks";

export class LLMRunner extends BaseLLMRunner {
  async arun(
    message: string,
    config?: RunnableConfig<{
      rateLimiter?: Ratelimit;
    }>,
  ): Promise<ExecutionResult> {
    try {
      const callback = new CostCallbackHandler();
      const appConfig = getConfig();
      const rateLimiterCallback = config?.configurable?.rateLimiter
        ? new UpstashRatelimitHandler(
            `${this.llm.getName()}:${appConfig.nodeEnv}`,
            {
              tokenRatelimit: config.configurable.rateLimiter,
            },
          )
        : undefined;
      const start = performance.now();
      const result = await super.ainvoke(message, {
        ...config,
        callbacks: rateLimiterCallback
          ? [callback, rateLimiterCallback]
          : [callback],
      });
      const end = performance.now();

      const getAIMessageContent = (m: AIMessage) => {
        if (Array.isArray(m.content)) {
          if (m.content[0].type === "text") {
            return m.content[0].text as string;
          }
          throw new Error("Unexpected message content type");
        }
        return m.content;
      };

      return {
        response:
          result instanceof AIMessage ? getAIMessageContent(result) : result,
        evaluationDetails: {
          promptTokens: callback.promptTokens,
          completionTokens: callback.completionTokens,
          successfulRequests: callback.successfulRequests,
          totalCost: callback.totalCost,
          responseTimeMs: Math.round(end - start),
        },
      };
    } catch (error) {
      throw wrapLLMError(error as APIError);
    }
  }
}
