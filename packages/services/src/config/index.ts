import "dotenv/config";

import { z } from "zod";

import {
  MODEL_KEYS,
  MODEL_PROVIDERS,
  ModelKeyEnum,
  type ModelProviderEnum,
  OPENAI_MODEL_KEYS,
} from "./enums";

export enum NodeEnvironment {
  TEST = "test",
  DEVELOPMENT = "development",
  STAGING = "staging",
  PRODUCTION = "production",
}

function getPostgresEnvVariables(prefix: string) {
  const pgEnvVar = {
    host: `${prefix}_DB_HOST`,
    port: `${prefix}_DB_PORT`,
    username: `${prefix}_DB_USERNAME`,
    password: `${prefix}_DB_PASSWORD`,
    database: `${prefix}_DB_DATABASE`,
    ssl: `${prefix}_DB_SSL`,
    timeout: `${prefix}_DB_TIMEOUT`,
    poolSize: `${prefix}_DB_POOL_SIZE`,
    connectionTimeoutMillis: `${prefix}_DB_CONNECTION_TIMEOUT_MILLIS`,
  };

  const zodSchema = {
    [pgEnvVar.host]: z.string().nonempty() as z.ZodType<string>,
    [pgEnvVar.port]: z.preprocess(Number, z.number().positive()),
    [pgEnvVar.username]: z.string().nonempty(),
    [pgEnvVar.password]: z.string().nonempty(),
    [pgEnvVar.database]: z.string().nonempty(),
    [pgEnvVar.ssl]: z.preprocess((s) => Boolean(Number(s || "0")), z.boolean()),
    [pgEnvVar.timeout]: z
      .preprocess(Number, z.number().positive())
      .default(30000),
    [pgEnvVar.poolSize]: z.preprocess(Number, z.number().positive()).optional(),
    [pgEnvVar.connectionTimeoutMillis]: z
      .preprocess(Number, z.number().positive())
      .default(10000),
  };

  return {
    zodSchema,
    pgEnvVar,
  };
}

export const AzureOpenAIDeploymentConfigSchema = z.object({
  name: z.string(),
  modelName: z.enum(OPENAI_MODEL_KEYS),
  tokensRateLimit: z.number(),
  requestsRateLimit: z.number(),
  services: z.array(z.string()),
  temperature: z.number().optional(),
  apiVersion: z.string().optional(),
});

export type AzureOpenAIDeploymentConfig = z.infer<
  typeof AzureOpenAIDeploymentConfigSchema
>;

export const AzureOpenAIServiceConfigSchema = z.object({
  name: z.string(),
  apiKey: z.string(),
  url: z.string().optional(),
});

export type AzureOpenAIServiceConfig = z.infer<
  typeof AzureOpenAIServiceConfigSchema
>;

export const OpenAIModelConfigSchema = z.object({
  modelName: z.enum(OPENAI_MODEL_KEYS),
  temperature: z.number().optional(),
  reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
  apiVersion: z.string().optional(),
});

export type OpenAIModelConfig = z.infer<typeof OpenAIModelConfigSchema>;

const appPostgresEnvVars = getPostgresEnvVariables("APP");

export const AppConfigEnvVariablesSchema = z.object({
  NODE_ENV: z.nativeEnum(NodeEnvironment),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .optional(),
  SENTRY_DSN: z.string().optional(),
  ...appPostgresEnvVars.zodSchema,
  UPSTASH_REDIS_REST_URL: z.string().nonempty().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().nonempty().optional(),
  // REDIS_HOST: z.string().nonempty(),
  // REDIS_PORT: z.preprocess(Number, z.number().positive()).default(6379),
  // REDIS_PASSWORD: z.string().optional(),
  // REDIS_TLS: z.preprocess((s) => Boolean(Number(s || "0")), z.boolean()),
  MAILGUN_API_KEY: z.string().optional(),
  MAILGUN_DOMAIN: z.string().optional(),
  MAILGUN_LOCAL_MAILER_HOSTNAME: z.string().optional(),
  // DRIZZLE_LOG_SQL: z.preprocess((s) => Boolean(Number(s || "0")), z.boolean()),
  LLM_RESPONSE_TIMEOUT_SEC: z.number({ coerce: true }).default(300),
  FINNHUB_API_KEY: z.string(),
  AZURE_OPENAI_DEPLOYMENTS: z
    .preprocess(
      (val) => JSON.parse(val as string),
      z.array(AzureOpenAIDeploymentConfigSchema),
    )
    .optional(),
  AZURE_OPENAI_SERVICES: z
    .preprocess(
      (val) => JSON.parse(val as string),
      z.array(AzureOpenAIServiceConfigSchema),
    )
    .optional(),
  STOCK_NEWS_API_KEY: z.string(),
  FIRECRAWL_API_KEY: z.string(),
  ALPHA_VANTAGE_API_KEY: z.string(),
  OPENAI_API_KEY: z.string(),
  OPENAI_MODEL_CONFIGS: z
    .preprocess(
      (val) => JSON.parse(val as string),
      z.array(OpenAIModelConfigSchema),
    )
    .optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL_CONFIGS: z
    .preprocess(
      (val) => JSON.parse(val as string),
      z.array(
        z.object({
          providerModelName: z.string().optional(),
          modelName: z.enum([ModelKeyEnum.DeepSeekReasoner]),
          temperature: z.number(),
        }),
      ),
    )
    .optional(),
  NEBIUS_API_KEY: z.string().optional(),
  NEBIUS_MODEL_CONFIGS: z
    .preprocess(
      (val) => JSON.parse(val as string),
      z.array(
        z.object({
          providerModelName: z.string().optional(),
          modelName: z.enum([
            ModelKeyEnum.DeepSeekReasoner,
            ModelKeyEnum.Llama33,
          ]),
          temperature: z.number(),
        }),
      ),
    )
    .optional(),
  MODEL_PROVIDERS: z.preprocess(
    (val) => JSON.parse(val as string),
    z.record(z.enum(MODEL_KEYS), z.enum(MODEL_PROVIDERS)),
  ),
});

export type AppConfigEnvVariables = z.infer<typeof AppConfigEnvVariablesSchema>;

export interface PostgresConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
  timeout: number;
  connectionTimeoutMillis: number;
  poolSize?: number;
}

export interface AppConfig {
  nodeEnv: NodeEnvironment;
  logLevel?: string;
  sentry: {
    dsn?: string;
  };
  postgres: PostgresConfig;
  // redis: {
  //   host: string;
  //   port: number;
  //   password?: string;
  //   tls: boolean;
  // };
  upstash?: {
    redisRestUrl: string;
    redisRestToken: string;
  };
  mailgun: {
    apiKey?: string;
    domain?: string;
    localMailerHostname?: string;
  };
  // drizzle: {
  //   logSql: boolean;
  // };
  llmResponseTimeoutSec: number;
  finnhubApiKey: string;
  stockNewsApiKey: string;
  firecrawlApiKey: string;
  alphaVantageApiKey: string;
  azureOpenAI?: {
    deployments: AzureOpenAIDeploymentConfig[];
    services: AzureOpenAIServiceConfig[];
  };
  openAI?: {
    apiKey: string;
    modelConfigs: OpenAIModelConfig[];
  };
  deepSeek?: {
    apiKey: string;
    modelConfigs: {
      modelName: string;
      temperature: number;
      providerModelName?: string;
    }[];
  };
  nebius?: {
    apiKey: string;
    modelConfigs: {
      modelName: string;
      temperature: number;
      providerModelName?: string;
    }[];
  };
  modelProviders?: Partial<Record<ModelKeyEnum, ModelProviderEnum>>;
}

function getPostgresConfig(
  appConfigValidated: Record<string, unknown>,
  pgEnvVars: ReturnType<typeof getPostgresEnvVariables>,
): PostgresConfig {
  return {
    host: appConfigValidated[pgEnvVars.pgEnvVar.host] as string,
    port: appConfigValidated[pgEnvVars.pgEnvVar.port] as number,
    username: appConfigValidated[pgEnvVars.pgEnvVar.username] as string,
    password: appConfigValidated[pgEnvVars.pgEnvVar.password] as string,
    database: appConfigValidated[pgEnvVars.pgEnvVar.database] as string,
    ssl: appConfigValidated[pgEnvVars.pgEnvVar.ssl] as boolean,
    timeout: appConfigValidated[pgEnvVars.pgEnvVar.timeout] as number,
    connectionTimeoutMillis: appConfigValidated[
      pgEnvVars.pgEnvVar.connectionTimeoutMillis
    ] as number,
    poolSize: appConfigValidated[pgEnvVars.pgEnvVar.poolSize] as
      | number
      | undefined,
  };
}

export function validate(config: Record<string, unknown>) {
  const appConfigValidated = AppConfigEnvVariablesSchema.parse(config);

  const nodeEnv = appConfigValidated.NODE_ENV;
  const appConfig: AppConfig = {
    nodeEnv,
    logLevel: appConfigValidated.LOG_LEVEL,
    sentry: {
      dsn: appConfigValidated.SENTRY_DSN,
    },
    postgres: {
      ...getPostgresConfig(appConfigValidated, appPostgresEnvVars),
    },
    upstash: appConfigValidated.UPSTASH_REDIS_REST_URL
      ? {
          redisRestUrl: appConfigValidated.UPSTASH_REDIS_REST_URL,
          redisRestToken: appConfigValidated.UPSTASH_REDIS_REST_TOKEN!,
        }
      : undefined,
    // redis: {
    //   host: appConfigValidated.REDIS_HOST,
    //   port: appConfigValidated.REDIS_PORT,
    //   password: appConfigValidated.REDIS_PASSWORD,
    //   tls: appConfigValidated.REDIS_TLS,
    // },
    mailgun: {
      apiKey: appConfigValidated.MAILGUN_API_KEY,
      domain: appConfigValidated.MAILGUN_DOMAIN,
      localMailerHostname: appConfigValidated.MAILGUN_LOCAL_MAILER_HOSTNAME,
    },
    // drizzle: {
    //   logSql: appConfigValidated.DRIZZLE_LOG_SQL,
    // },
    llmResponseTimeoutSec: appConfigValidated.LLM_RESPONSE_TIMEOUT_SEC,
    finnhubApiKey: appConfigValidated.FINNHUB_API_KEY,
    stockNewsApiKey: appConfigValidated.STOCK_NEWS_API_KEY,
    firecrawlApiKey: appConfigValidated.FIRECRAWL_API_KEY,
    alphaVantageApiKey: appConfigValidated.ALPHA_VANTAGE_API_KEY,
    azureOpenAI: appConfigValidated.AZURE_OPENAI_SERVICES
      ? {
          deployments: appConfigValidated.AZURE_OPENAI_DEPLOYMENTS!,
          services: appConfigValidated.AZURE_OPENAI_SERVICES,
        }
      : undefined,
    openAI: appConfigValidated.OPENAI_API_KEY
      ? {
          apiKey: appConfigValidated.OPENAI_API_KEY,
          modelConfigs: appConfigValidated.OPENAI_MODEL_CONFIGS!,
        }
      : undefined,
    deepSeek: appConfigValidated.DEEPSEEK_API_KEY
      ? {
          apiKey: appConfigValidated.DEEPSEEK_API_KEY,
          modelConfigs: appConfigValidated.DEEPSEEK_MODEL_CONFIGS!,
        }
      : undefined,
    modelProviders: appConfigValidated.MODEL_PROVIDERS,
    nebius: appConfigValidated.NEBIUS_API_KEY
      ? {
          apiKey: appConfigValidated.NEBIUS_API_KEY,
          modelConfigs: appConfigValidated.NEBIUS_MODEL_CONFIGS!,
        }
      : undefined,
  };

  return { config: appConfig };
}

let appConfigStatic: AppConfig | undefined;

export function getAppConfigStatic() {
  if (appConfigStatic !== undefined) {
    return appConfigStatic;
  }

  const parsedAppConfig = validate(process.env);
  appConfigStatic = parsedAppConfig.config;
  return appConfigStatic;
}

export const appConfigSymbol: symbol = Symbol.for("AppConfig");
