import { UpstashRatelimitHandler } from "@langchain/community/callbacks/handlers/upstash_ratelimit";
import { AIMessage } from "@langchain/core/messages";
import { type RunnableConfig } from "@langchain/core/runnables";
import { AzureChatOpenAI } from "@langchain/openai";
import { type Ratelimit } from "@upstash/ratelimit";
import {
  type AzureOpenAIDeploymentConfig,
  type AzureOpenAIServiceConfig,
  getConfig,
} from "@zysk/services";
import { type APIError } from "openai";

import { BaseLLMRunner, ModelContainer, ModelIdentity } from "../core/base";
import {
  ModelKeyEnum,
  ModelProviderEnum,
  ModelVendorEnum,
} from "../core/enums";
import { type ExecutionResult } from "../core/schemas";
import { OpenAICallbackHandler, wrapOpenAIError } from "./callbacks";

type ReasoningEffort = "low" | "medium" | "high" | undefined;

interface AzureOpenAIModelConfig {
  endpointUrl: string;
  apiKey: string;
  azureDeployment: string;
  llmModelName: string;
  temperature: number | undefined;
  reasoningEffort: ReasoningEffort | undefined;
  apiVersion: string | undefined;
}

export class OpenAIRunner extends BaseLLMRunner {
  async arun(
    message: string,
    config?: RunnableConfig<{
      rateLimiter?: Ratelimit;
    }>,
  ): Promise<ExecutionResult> {
    try {
      const callback = new OpenAICallbackHandler();
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
      return {
        response:
          result instanceof AIMessage ? (result.content as string) : result,
        evaluationDetails: {
          promptTokens: callback.promptTokens,
          completionTokens: callback.completionTokens,
          successfulRequests: callback.successfulRequests,
          totalCost: callback.totalCost,
          responseTimeMs: Math.round(end - start),
        },
      };
    } catch (error) {
      throw wrapOpenAIError(error as APIError);
    }
  }
}

const apiVersion = "2024-02-01";

function buildAzureOpenAIModelConfigs(
  modelKey: ModelKeyEnum,
  services: AzureOpenAIServiceConfig[],
  deployments: AzureOpenAIDeploymentConfig[],
  reasoningEffort?: ReasoningEffort,
) {
  const res: AzureOpenAIModelConfig[] = [];
  const modelDeployments = deployments.filter(
    (d) => d.modelName === String(modelKey),
  );

  for (const deployment of modelDeployments) {
    const service = services.find((s) => s.name === deployment.services[0]);
    if (!service) {
      throw new Error(
        `Azure OpenAI Service with name ${deployment.services[0]} not found`,
      );
    }

    const endpointUrl = service.url
      ? service.url
      : `https://${service.name}.api.cognitive.microsoft.com/openai/deployments/${deployment.name}/chat/completions?api-version=${deployment.apiVersion}`;

    res.push({
      endpointUrl,
      apiKey: service.apiKey,
      azureDeployment: deployment.name,
      llmModelName: deployment.modelName,
      temperature: deployment.temperature,
      reasoningEffort,
      apiVersion: deployment.apiVersion ?? apiVersion,
    });
  }

  return res;
}

function getOpenaiContainers(config: AzureOpenAIModelConfig[]) {
  const res: ModelContainer[] = [];
  for (const conf of config) {
    const container = new ModelContainer(
      new OpenAIRunner(
        new AzureChatOpenAI({
          azureOpenAIEndpoint: conf.endpointUrl,
          azureOpenAIApiKey: conf.apiKey,
          azureOpenAIApiVersion: conf.apiVersion,
          azureOpenAIApiDeploymentName: conf.azureDeployment,
          temperature: conf.temperature,
          model: conf.llmModelName,
          maxRetries: 0,
          reasoningEffort: conf.reasoningEffort,
        }),
      ),
      new ModelIdentity(
        conf.endpointUrl,
        conf.llmModelName,
        ModelVendorEnum.OpenAI,
        ModelProviderEnum.Azure,
      ),
    );
    res.push(container);
  }

  return res;
}

export function getAzureLLMContainers(modelKey: ModelKeyEnum) {
  const appConfig = getConfig();
  if (!appConfig.azureOpenAI) {
    throw new Error("Azure OpenAI config not found");
  }
  const configs = buildAzureOpenAIModelConfigs(
    modelKey,
    appConfig.azureOpenAI.services,
    appConfig.azureOpenAI.deployments,
    modelKey === ModelKeyEnum.GptO3Mini ? "high" : undefined,
  );

  return getOpenaiContainers(configs);
}
