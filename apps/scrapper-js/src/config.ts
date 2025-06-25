import "dotenv/config";

import { z } from "zod";

export const AppConfigEnvVariablesSchema = z.object({
  UPSTASH_REDIS_URL: z.string(),
  UPSTASH_REDIS_PASSWORD: z.string(),
  NODE_ENV: z.string(),
});

export type AppConfigEnvVariables = z.infer<typeof AppConfigEnvVariablesSchema>;

export interface AppConfig {
  upstashRedisUrl: string;
  upstashRedisPassword: string;
  env: string;
}

export function validate(config: Record<string, unknown>) {
  const appConfigValidated = AppConfigEnvVariablesSchema.parse(config);

  const appConfig: AppConfig = {
    upstashRedisUrl: appConfigValidated.UPSTASH_REDIS_URL,
    upstashRedisPassword: appConfigValidated.UPSTASH_REDIS_PASSWORD,
    env: appConfigValidated.NODE_ENV,
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
