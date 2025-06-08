export enum ModelProviderEnum {
  OpenAI = "openai",
  AWS = "aws",
  Anthropic = "anthropic",
  Azure = "azure",
  Mosaic = "mosaic",
  Cohere = "cohere",
  Meta = "meta",
  Google = "google",
  Mistral = "mistral",
  DeepSeek = "deepseek",
  Nebius = "nebius",
}

export enum ModelOwnerEnum {
  OpenAI = "openai",
  Anthropic = "anthropic",
  Google = "google",
  DeepSeek = "deepseek",
  Meta = "meta",
}

export enum ModelKeyEnum {
  Gpt4o = "gpt-4o",
  Gpt4oMini = "gpt-4o-mini",
  GptO1Mini = "o1-mini",
  GptO1 = "o1",
  GptO3Mini = "o3-mini",
  Gpt4oO1Mini = "4o-o1-mini",
  Claude35Sonnet = "claude35-sonnet",
  DeepSeekReasoner = "deepseek-reasoner",
  Llama33 = "llama33",
  DeepSeekLlama = "deepseek-llama",
  GeminiFlash25 = "gemini-2.5-flash",
}

export type OpenAIModelKey =
  | ModelKeyEnum.Gpt4o
  | ModelKeyEnum.Gpt4oMini
  | ModelKeyEnum.GptO1Mini
  | ModelKeyEnum.GptO1
  | ModelKeyEnum.GptO3Mini;

export type MetaModelKey = ModelKeyEnum.Llama33;

export type GoogleModelKey = ModelKeyEnum.GeminiFlash25;

export const OPENAI_MODEL_KEYS = [
  ModelKeyEnum.Gpt4o,
  ModelKeyEnum.Gpt4oMini,
  ModelKeyEnum.GptO1Mini,
  ModelKeyEnum.GptO1,
  ModelKeyEnum.GptO3Mini,
] as const;

export const MODEL_PROVIDERS = [
  ModelProviderEnum.OpenAI,
  ModelProviderEnum.Azure,
  ModelProviderEnum.Nebius,
  ModelProviderEnum.DeepSeek,
] as const;

export const DEEPSEEK_MODEL_KEYS = [ModelKeyEnum.DeepSeekReasoner] as const;

export const META_MODEL_KEYS = [ModelKeyEnum.Llama33, ModelKeyEnum.DeepSeekLlama] as const;

export const GOOGLE_MODEL_KEYS = [ModelKeyEnum.GeminiFlash25] as const;

export const MODEL_KEYS = [
  ...OPENAI_MODEL_KEYS,
  ...DEEPSEEK_MODEL_KEYS,
  ...META_MODEL_KEYS,
  ...GOOGLE_MODEL_KEYS,
] as const;
