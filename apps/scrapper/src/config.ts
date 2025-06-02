import "dotenv/config";

import { z } from "zod";

export const AppConfigEnvVariablesSchema = z.object({
  CAPTCHA_TOKEN: z.string().optional(),
  SCRAPPER_BROWSER_WS: z.string().optional(),
  PROXY_SERVER: z.string().optional(),
  PROXY_USERNAME: z.string().optional(),
  PROXY_PASSWORD: z.string().optional(),
  UPSTASH_REDIS_URL: z.string(),
  UPSTASH_REDIS_PASSWORD: z.string(),
});

export type AppConfigEnvVariables = z.infer<typeof AppConfigEnvVariablesSchema>;

export interface AppConfig {
  captchaToken?: string;
  scrapperBrowserWs?: string;
  proxyServer?: string;
  proxyUsername?: string;
  proxyPassword?: string;
  upstashRedisUrl: string;
  upstashRedisPassword: string;
}

export function validate(config: Record<string, unknown>) {
  const appConfigValidated = AppConfigEnvVariablesSchema.parse(config);

  const appConfig: AppConfig = {
    captchaToken: appConfigValidated.CAPTCHA_TOKEN,
    scrapperBrowserWs: appConfigValidated.SCRAPPER_BROWSER_WS,
    proxyServer: appConfigValidated.PROXY_SERVER,
    proxyUsername: appConfigValidated.PROXY_USERNAME,
    proxyPassword: appConfigValidated.PROXY_PASSWORD,
    upstashRedisUrl: appConfigValidated.UPSTASH_REDIS_URL,
    upstashRedisPassword: appConfigValidated.UPSTASH_REDIS_PASSWORD,
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
