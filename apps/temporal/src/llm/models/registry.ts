import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import {
  DEEPSEEK_MODEL_KEYS,
  getConfig,
  META_MODEL_KEYS,
  GOOGLE_MODEL_KEYS,
  type MetaModelKey,
  ModelKeyEnum,
  ModelProviderEnum,
  OPENAI_MODEL_KEYS,
  type OpenAIModelKey,
  type GoogleModelKey,
} from "@zysk/services";
import { isObject } from "lodash";

import {
  type ModelContainer,
  SequentialModelContainer,
  SequentialModelContainerWithFallback,
} from "../core/base";
import { getDeepSeekModelContainers } from "./deepseek-models";
import { getMetaContainers } from "./meta-models";
import { getOpenAIModelContainers } from "./openai-models";
import { getGoogleContainers } from "./google-models";

export class ModelNotFoundError extends Error {
  constructor(modelKey: ModelKeyEnum) {
    super(`Model not found: ${modelKey}`);
    this.name = "ModelNotFoundError";
  }
}

export const MODEL_TO_MAX_TOKENS = {
  [ModelKeyEnum.Gpt4o]: 128_000,
  [ModelKeyEnum.Gpt4oMini]: 128_000,
  [ModelKeyEnum.GptO1Mini]: 128_000,
  [ModelKeyEnum.GptO1]: 200_000,
  [ModelKeyEnum.GptO3Mini]: 200_000,
  [ModelKeyEnum.DeepSeekReasoner]: {
    [ModelProviderEnum.DeepSeek]: 65_000,
    [ModelProviderEnum.Nebius]: 160_000,
  },
  [ModelKeyEnum.Llama33]: 128_000,
  [ModelKeyEnum.DeepSeekLlama]: 128_000,
  [ModelKeyEnum.GeminiFlash25]: 1_000_000,
} as Record<ModelKeyEnum, number | Record<ModelProviderEnum, number>>;

export function getMaxTokens(modelKey: ModelKeyEnum) {
  const appConfig = getConfig();
  const config = MODEL_TO_MAX_TOKENS[modelKey];
  if (
    isObject(config) &&
    appConfig.modelProviders?.[modelKey] &&
    config[appConfig.modelProviders[modelKey]]
  ) {
    return config[appConfig.modelProviders[modelKey]];
  }
  return config as number;
}

function createSequentialModelContainer(
  modelKey: ModelKeyEnum,
  providers?: Partial<Record<ModelKeyEnum, ModelProviderEnum>>,
) {
  const appConfig = getConfig();
  const ratelimit = appConfig.upstash
    ? new Ratelimit({
        redis: new Redis({
          url: appConfig.upstash.redisRestUrl,
          token: appConfig.upstash.redisRestToken,
        }),
        limiter: Ratelimit.fixedWindow(200_000, "60s"),
      })
    : undefined;

  let containers: ModelContainer[] = [];
  if (DEEPSEEK_MODEL_KEYS.includes(modelKey)) {
    containers = getDeepSeekModelContainers(modelKey, providers?.[modelKey]);
  }

  if (OPENAI_MODEL_KEYS.includes(modelKey)) {
    containers = getOpenAIModelContainers(
      modelKey as OpenAIModelKey,
      ModelProviderEnum.OpenAI,
    );
  }

  if (META_MODEL_KEYS.includes(modelKey)) {
    containers = getMetaContainers(
      modelKey as MetaModelKey,
      ModelProviderEnum.Nebius,
    );
  }

  if (GOOGLE_MODEL_KEYS.includes(modelKey)) {
    containers = getGoogleContainers(
      modelKey as GoogleModelKey,
      ModelProviderEnum.Google,
    );
  }

  return new SequentialModelContainer(
    modelKey,
    containers,
    getMaxTokens(modelKey),
    providers?.[modelKey] === ModelProviderEnum.Azure ? ratelimit : undefined,
  );
}

const models = new Proxy(
  {} as Record<ModelKeyEnum, SequentialModelContainer | undefined>,
  {
    get: (target, prop: string) => {
      const config = getConfig();
      const modelKey = prop as ModelKeyEnum;
      const model =
        target[modelKey] ??
        createSequentialModelContainer(modelKey, config.modelProviders);
      target[modelKey] = model;
      return model;
    },
    has: (target, prop: string) => {
      return target[prop as OpenAIModelKey] !== undefined;
    },
  },
);

export function createSequentialModelContainerWithFallback(
  modelKey: ModelKeyEnum,
) {
  switch (modelKey) {
    case ModelKeyEnum.Gpt4o:
      return new SequentialModelContainerWithFallback([
        models[ModelKeyEnum.Gpt4o]!,
        models[ModelKeyEnum.GptO1]!,
      ]);
    case ModelKeyEnum.Gpt4oMini:
      return new SequentialModelContainerWithFallback([
        models[ModelKeyEnum.Gpt4oMini]!,
        models[ModelKeyEnum.GptO1Mini]!,
      ]);
    case ModelKeyEnum.GptO1Mini:
      return new SequentialModelContainerWithFallback([
        models[ModelKeyEnum.GptO1Mini]!,
        models[ModelKeyEnum.GptO3Mini]!,
      ]);
    case ModelKeyEnum.GptO1:
      return new SequentialModelContainerWithFallback([
        models[ModelKeyEnum.GptO1]!,
        models[ModelKeyEnum.Gpt4o]!,
      ]);
    case ModelKeyEnum.GptO3Mini:
      return new SequentialModelContainerWithFallback([
        models[ModelKeyEnum.GptO3Mini]!,
        models[ModelKeyEnum.GptO1Mini]!,
      ]);
    case ModelKeyEnum.DeepSeekReasoner:
      return new SequentialModelContainerWithFallback([
        models[ModelKeyEnum.DeepSeekReasoner]!,
      ]);
    case ModelKeyEnum.Llama33:
      return new SequentialModelContainerWithFallback([
        models[ModelKeyEnum.Llama33]!,
      ]);
    case ModelKeyEnum.DeepSeekLlama:
        return new SequentialModelContainerWithFallback([
          models[ModelKeyEnum.DeepSeekLlama]!,
        ]);
    case ModelKeyEnum.GeminiFlash25:
      return new SequentialModelContainerWithFallback([
        models[ModelKeyEnum.GeminiFlash25]!,
      ]);
    default:
      throw new ModelNotFoundError(modelKey);
  }
}

export const modelsWithFallback = new Proxy(
  {} as Record<ModelKeyEnum, SequentialModelContainerWithFallback | undefined>,
  {
    get: (target, prop: string) => {
      const modelKey = prop as ModelKeyEnum;
      const model =
        target[modelKey] ??
        createSequentialModelContainerWithFallback(modelKey);
      target[modelKey] = model;
      return model;
    },
  },
);
