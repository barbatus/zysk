import { AzureChatOpenAI } from "@langchain/openai";
import {
  type AzureOpenAIDeploymentConfig,
  type AzureOpenAIServiceConfig,
  getAgenticConfig,
  ModelKeyEnum,
  ModelOwnerEnum,
  ModelProviderEnum,
  type OpenAIModelKey,
} from "@zysk/services";

import { ModelContainer, ModelIdentity } from "../core/base";
import { LLMRunner } from "./runners";

type ReasoningEffort = "low" | "medium" | "high" | undefined;

interface AzureOpenAIModelConfig {
  endpointUrl: string;
  apiKey: string;
  azureDeployment: string;
  llmModelName: OpenAIModelKey;
  temperature: number | undefined;
  reasoningEffort: ReasoningEffort | undefined;
  apiVersion: string | undefined;
}

const apiVersion = "2024-02-01";

function buildAzureOpenAIModelConfigs(
  modelKey: OpenAIModelKey,
  services: AzureOpenAIServiceConfig[],
  deployments: AzureOpenAIDeploymentConfig[],
  reasoningEffort?: ReasoningEffort,
) {
  const res: AzureOpenAIModelConfig[] = [];
  const modelDeployments = deployments.filter((d) => d.modelName === modelKey);

  for (const deployment of modelDeployments) {
    const service = services.find((s) => s.name === deployment.services[0]);
    if (!service) {
      throw new Error(
        `Azure OpenAI Service with name ${deployment.services[0]} not found`,
      );
    }

    const endpointUrl = service.url
      ? service.url
      : `https://${service.name}.api.cognitive.microsoft.com/openai/deployments/${deployment.name}/chat/completions?api-version=${deployment.apiVersion ?? apiVersion}`;

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
      new LLMRunner(
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
        ModelProviderEnum.Azure,
        ModelOwnerEnum.OpenAI,
      ),
    );
    res.push(container);
  }

  return res;
}

export function getAzureLLMContainers(modelKey: OpenAIModelKey) {
  const appConfig = getAgenticConfig();
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
