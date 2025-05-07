import { AIMessage } from "@langchain/core/messages";
import { type RunnableConfig } from "@langchain/core/runnables";
import { AzureChatOpenAI } from "@langchain/openai";

import {
  appConfig,
  type AzureOpenAIDeploymentConfig,
  type AzureOpenAIServiceConfig,
} from "#/config";

import { BaseLLMRunner, ModelContainer, ModelIdentity } from "../core/base";
import { ModelProviderEnum, ModelVendorEnum } from "../core/enums";
import { type ExecutionResult } from "../core/schemas";
import { OpenAICallbackHandler } from "./callbacks";

type ReasoningEffort = "low" | "medium" | "high" | undefined;

type ContainerType =
  | "4o_containers"
  | "4omini_containers"
  | "o1_mini_containers"
  | "o1_containers"
  | "o3_mini_containers";

interface AzureOpenAIModelConfig {
  endpointUrl: string;
  apiKey: string;
  azureDeployment: string;
  llmModelName: string;
  temperature: number | undefined;
  reasoningEffort: ReasoningEffort | undefined;
  apiVersion: string | undefined;
}

class AzureOpenAIRunner extends BaseLLMRunner {
  async arun(
    message: string,
    config?: RunnableConfig,
  ): Promise<ExecutionResult> {
    const callback = new OpenAICallbackHandler();
    const start = performance.now();
    const result = await super.ainvoke(message, {
      ...config,
      callbacks: [callback],
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
  }
}

const apiVersion = "2024-02-01";

function buildAzureOpenAIModelConfigs(
  modelName: string,
  services: AzureOpenAIServiceConfig[],
  deployments: AzureOpenAIDeploymentConfig[],
  reasoningEffort?: ReasoningEffort,
) {
  const res: AzureOpenAIModelConfig[] = [];
  const modelDeployments = deployments.filter((d) => d.modelName === modelName);

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
      new AzureOpenAIRunner(
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

export function getAzureLLMContainers(type: ContainerType) {
  const map = {
    "4o_containers": "gpt-4o",
    "4omini_containers": "gpt-4o-mini",
    o1_mini_containers: "o1-mini",
    o1_containers: "o1",
    o3_mini_containers: "o3-mini",
  };

  const modelName = map[type];

  if (!modelName) {
    throw new Error(`Invalid container type: ${type}`);
  }

  const configs = buildAzureOpenAIModelConfigs(
    modelName,
    appConfig.azureOpenAI.services,
    appConfig.azureOpenAI.deployments,
    modelName === "o3-mini" ? "high" : undefined,
  );

  return getOpenaiContainers(configs);
}
