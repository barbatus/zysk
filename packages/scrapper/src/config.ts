import "dotenv/config";

import { z } from "zod";

export const AppConfigEnvVariablesSchema = z.object({
  CAPTCHA_TOKEN: z.string().optional(),
  SCRAPPER_BROWSER_WS: z.string().optional(),
  PROXY_SERVER: z.string().optional(),
  PROXY_PORT: z.string().optional(),
  PROXY_USERNAME: z.string().optional(),
  PROXY_PASSWORD: z.string().optional(),
  NODE_ENV: z.string(),
});

export type AppConfigEnvVariables = z.infer<typeof AppConfigEnvVariablesSchema>;

export interface AppConfig {
  captchaToken?: string;
  scrapperBrowserWs?: string;
  proxyServer?: string;
  proxyPort?: string;
  proxyUsername?: string;
  proxyPassword?: string;
  env: string;
}

export function validate(config: Record<string, unknown>) {
  const appConfigValidated = AppConfigEnvVariablesSchema.parse(config);

  const appConfig: AppConfig = {
    captchaToken: appConfigValidated.CAPTCHA_TOKEN,
    scrapperBrowserWs: appConfigValidated.SCRAPPER_BROWSER_WS,
    proxyServer: appConfigValidated.PROXY_SERVER,
    proxyPort: appConfigValidated.PROXY_PORT,
    proxyUsername: appConfigValidated.PROXY_USERNAME,
    proxyPassword: appConfigValidated.PROXY_PASSWORD,
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
