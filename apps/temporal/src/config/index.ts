import "dotenv/config";

import { z } from "zod";

export enum NodeEnvironment {
  TEST = "test",
  DEVELOPMENT = "development",
  STAGING = "staging",
  PRODUCTION = "production",
}

function commaSeparatedList(s: unknown): string[] {
  if (typeof s === "string") {
    return s.trim().split(",");
  }
  return [];
}

function getPostgresEnvVariables(prefix: string) {
  const pgEnvVar = {
    host: `${prefix}_POSTGRES_HOST`,
    port: `${prefix}_POSTGRES_PORT`,
    username: `${prefix}_POSTGRES_USERNAME`,
    password: `${prefix}_POSTGRES_PASSWORD`,
    database: `${prefix}_POSTGRES_DATABASE`,
    ssl: `${prefix}_POSTGRES_SSL`,
    timeout: `${prefix}_POSTGRES_TIMEOUT`,
    poolSize: `${prefix}_POSTGRES_POOL_SIZE`,
    connectionTimeoutMillis: `${prefix}_POSTGRES_CONNECTION_TIMEOUT_MILLIS`,
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

const appPostgresEnvVars = getPostgresEnvVariables("APP");
const analyticsPostgresEnvVars = getPostgresEnvVariables("ANALYTICS");

export const AppConfigEnvVariablesSchema = z.object({
  NODE_ENV: z.nativeEnum(NodeEnvironment),
  REMOTE_ENV: z.string().optional(),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .optional(),
  UNIT_TEST: z.preprocess((s) => Boolean(Number(s || "0")), z.boolean()),
  INTEGRATION_TEST: z.preprocess((s) => Boolean(Number(s || "0")), z.boolean()),
  SENTRY_DSN: z.string().optional(),
  ...appPostgresEnvVars.zodSchema,
  APP_POSTGRES_ENCRYPTION_SECRET: z.string().nonempty(),
  ...analyticsPostgresEnvVars.zodSchema,
  REDIS_HOST: z.string().nonempty(),
  REDIS_PORT: z.preprocess(Number, z.number().positive()).default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z.preprocess((s) => Boolean(Number(s || "0")), z.boolean()),
  KAFKA_BROKERS: z.preprocess(commaSeparatedList, z.array(z.string())),
  KAFKA_SSL: z.preprocess((s) => Boolean(Number(s || "0")), z.boolean()),
  JWT_SECRET: z.string().nonempty(),
  JWT_OLD_SECRETS: z.preprocess(commaSeparatedList, z.array(z.string())),
  JWT_DAGSTER_SECRET: z.string().nonempty(),
  JWT_OLD_DAGSTER_SECRETS: z.preprocess(
    commaSeparatedList,
    z.array(z.string()),
  ),
  CORS_ORIGIN: z.preprocess(commaSeparatedList, z.array(z.string())),
  API_ROOT_URL: z.string().nonempty(),
  PUBLIC_ASSETS_URL: z.string().nonempty(),
  WORKOS_API_KEY: z.string().nonempty(),
  WORKOS_CLIENT_ID: z.string().nonempty(),
  WORKOS_FROM_EMAIL: z.string().nonempty(),
  MAILGUN_API_KEY: z.string().optional(),
  MAILGUN_DOMAIN: z.string().optional(),
  MAILGUN_LOCAL_MAILER_HOSTNAME: z.string().optional(),
  POSTHOG_API_KEY: z.string().nonempty(),
  POSTHOG_PERSONAL_API_KEY: z.string().optional(),
  GITHUB_APP_ID: z.string().nonempty(),
  GITHUB_APP_SLUG: z.string().nonempty(),
  GITHUB_APP_PRIVATE_KEY: z.string().nonempty(),
  GITHUB_CLIENT_ID: z.string().nonempty(),
  GITHUB_CLIENT_SECRET: z.string().nonempty(),
  BASIC_GITHUB_APP_ID: z.string().default(""),
  BASIC_GITHUB_APP_SLUG: z.string().default(""),
  BASIC_GITHUB_APP_PRIVATE_KEY: z.string().default(""),
  BASIC_GITHUB_CLIENT_ID: z.string().default(""),
  BASIC_GITHUB_CLIENT_SECRET: z.string().default(""),
  GITHUB_PROVISIONER_APP_ID: z.string().default(""),
  GITHUB_PROVISIONER_APP_SLUG: z.string().default(""),
  GITHUB_PROVISIONER_APP_PRIVATE_KEY_ENC: z.string().default(""),
  GITHUB_PROVISIONER_CLIENT_ID: z.string().default(""),
  GITHUB_PROVISIONER_CLIENT_SECRET: z.string().default(""),
  SENTRY_PROVISIONER_APP_SLUG: z.string().default(""),
  SENTRY_PROVISIONER_APP_CLIENT_ID: z.string().default(""),
  SENTRY_PROVISIONER_APP_CLIENT_SECRET: z.string().default(""),
  PROVISIONER_API_BASE_URL: z.string().default(""),
  SLACK_CLIENT_ID: z.string(),
  SLACK_CLIENT_SECRET: z.string(),
  SLACK_SIGNING_SECRET: z.string(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  DRIZZLE_LOG_SQL: z.preprocess((s) => Boolean(Number(s || "0")), z.boolean()),
  AWS_REGION: z.string(),
  AWS_S3_METRIC_DIGEST_BUCKET: z.string(),
  LLM_RESPONSE_TIMEOUT_SEC: z.number().default(300),
  FINNHUB_API_KEY: z.string(),
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
  remoteEnv?: string;
  logLevel?: string;
  sentry: {
    dsn?: string;
  };
  postgres: {
    app: PostgresConfig & {
      encryptionSecret: string;
    };
    analytics: PostgresConfig;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    tls: boolean;
  };
  kafka: {
    brokers: string[];
    ssl: boolean;
  };
  jwt: {
    secret: string;
    oldSecrets: string[];
    dagsterSecret: string;
    dagsterOldSecrets: string[];
  };
  corsOrigins: string[];
  appHostname: string;
  apiRootUrl: string;
  publicAssetsUrl: string;
  authLoginUrl: string;
  authRedirectUrl: string;
  workos: {
    apiKey: string;
    clientId: string;
    fromEmail: string;
  };
  mailgun: {
    apiKey?: string;
    domain?: string;
    localMailerHostname?: string;
  };
  posthog: {
    apiKey: string;
    personalApiKey?: string;
  };
  github: {
    appId: string;
    appSlug: string;
    appPrivateKey: string;
    clientId: string;
    clientSecret: string;
  };
  basicGithub: {
    appId: string;
    appSlug: string;
    appPrivateKey: string;
    clientId: string;
    clientSecret: string;
  };
  githubProvisioner: {
    appId: string;
    appSlug: string;
    appPrivateKeyEnc: string;
    clientId: string;
    clientSecret: string;
  };
  provisionerApi: {
    baseUrl: string;
  };
  sentryProvisioner: {
    appSlug: string;
    appClientId: string;
    appClientSecret: string;
  };
  slack: {
    clientId: string;
    clientSecret: string;
    signingSecret: string;
  };
  google: {
    serviceAccountEmail?: string;
    privateKey?: string;
  };
  drizzle: {
    logSql: boolean;
  };
  aws: {
    region: string;
    metricDigestBucket: string;
  };
  llmResponseTimeoutSec: number;
  finnhubApiKey: string;
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
  const appHostname = appConfigValidated.CORS_ORIGIN[0];
  const appConfig: AppConfig = {
    nodeEnv,
    remoteEnv: appConfigValidated.REMOTE_ENV,
    logLevel: appConfigValidated.LOG_LEVEL,
    sentry: {
      dsn: appConfigValidated.SENTRY_DSN,
    },
    postgres: {
      app: {
        ...getPostgresConfig(appConfigValidated, appPostgresEnvVars),
        encryptionSecret: appConfigValidated.APP_POSTGRES_ENCRYPTION_SECRET,
      },
      analytics: getPostgresConfig(
        appConfigValidated,
        analyticsPostgresEnvVars,
      ),
    },
    redis: {
      host: appConfigValidated.REDIS_HOST,
      port: appConfigValidated.REDIS_PORT,
      password: appConfigValidated.REDIS_PASSWORD,
      tls: appConfigValidated.REDIS_TLS,
    },
    kafka: {
      brokers: appConfigValidated.KAFKA_BROKERS,
      ssl: appConfigValidated.KAFKA_SSL,
    },
    jwt: {
      secret: appConfigValidated.JWT_SECRET,
      oldSecrets: appConfigValidated.JWT_OLD_SECRETS,
      dagsterSecret: appConfigValidated.JWT_DAGSTER_SECRET,
      dagsterOldSecrets: appConfigValidated.JWT_OLD_DAGSTER_SECRETS,
    },
    corsOrigins: appConfigValidated.CORS_ORIGIN,
    appHostname,
    apiRootUrl: appConfigValidated.API_ROOT_URL,
    publicAssetsUrl: appConfigValidated.PUBLIC_ASSETS_URL,
    authLoginUrl: `${appHostname}/auth/login`,
    authRedirectUrl: `${appHostname}/auth/callback`,
    workos: {
      apiKey: appConfigValidated.WORKOS_API_KEY,
      clientId: appConfigValidated.WORKOS_CLIENT_ID,
      fromEmail: appConfigValidated.WORKOS_FROM_EMAIL,
    },
    mailgun: {
      apiKey: appConfigValidated.MAILGUN_API_KEY,
      domain: appConfigValidated.MAILGUN_DOMAIN,
      localMailerHostname: appConfigValidated.MAILGUN_LOCAL_MAILER_HOSTNAME,
    },
    posthog: {
      apiKey: appConfigValidated.POSTHOG_API_KEY,
      personalApiKey: appConfigValidated.POSTHOG_PERSONAL_API_KEY,
    },
    github: {
      appId: appConfigValidated.GITHUB_APP_ID,
      appSlug: appConfigValidated.GITHUB_APP_SLUG,
      appPrivateKey: appConfigValidated.GITHUB_APP_PRIVATE_KEY,
      clientId: appConfigValidated.GITHUB_CLIENT_ID,
      clientSecret: appConfigValidated.GITHUB_CLIENT_SECRET,
    },
    basicGithub: {
      appId: appConfigValidated.BASIC_GITHUB_APP_ID,
      appSlug: appConfigValidated.BASIC_GITHUB_APP_SLUG,
      appPrivateKey: appConfigValidated.BASIC_GITHUB_APP_PRIVATE_KEY,
      clientId: appConfigValidated.BASIC_GITHUB_CLIENT_ID,
      clientSecret: appConfigValidated.BASIC_GITHUB_CLIENT_SECRET,
    },
    githubProvisioner: {
      appId: appConfigValidated.GITHUB_PROVISIONER_APP_ID,
      appSlug: appConfigValidated.GITHUB_PROVISIONER_APP_SLUG,
      appPrivateKeyEnc:
        appConfigValidated.GITHUB_PROVISIONER_APP_PRIVATE_KEY_ENC,
      clientId: appConfigValidated.GITHUB_PROVISIONER_CLIENT_ID,
      clientSecret: appConfigValidated.GITHUB_PROVISIONER_CLIENT_SECRET,
    },
    provisionerApi: {
      baseUrl: appConfigValidated.PROVISIONER_API_BASE_URL,
    },
    sentryProvisioner: {
      appSlug: appConfigValidated.SENTRY_PROVISIONER_APP_SLUG,
      appClientId: appConfigValidated.SENTRY_PROVISIONER_APP_CLIENT_ID,
      appClientSecret: appConfigValidated.SENTRY_PROVISIONER_APP_CLIENT_SECRET,
    },
    slack: {
      clientId: appConfigValidated.SLACK_CLIENT_ID,
      clientSecret: appConfigValidated.SLACK_CLIENT_SECRET,
      signingSecret: appConfigValidated.SLACK_SIGNING_SECRET,
    },
    google: {
      serviceAccountEmail: appConfigValidated.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey: appConfigValidated.GOOGLE_PRIVATE_KEY,
    },
    drizzle: {
      logSql: appConfigValidated.DRIZZLE_LOG_SQL,
    },
    aws: {
      region: appConfigValidated.AWS_REGION,
      metricDigestBucket: appConfigValidated.AWS_S3_METRIC_DIGEST_BUCKET,
    },
    llmResponseTimeoutSec: appConfigValidated.LLM_RESPONSE_TIMEOUT_SEC,
    finnhubApiKey: appConfigValidated.FINNHUB_API_KEY,
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

export const appConfig = getAppConfigStatic();
