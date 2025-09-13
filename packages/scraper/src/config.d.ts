import "dotenv/config";
import { z } from "zod";
export declare const AppConfigEnvVariablesSchema: z.ZodObject<{
    CAPTCHA_TOKEN: z.ZodOptional<z.ZodString>;
    SCRAPPER_BROWSER_WS: z.ZodOptional<z.ZodString>;
    PROXY_SERVER: z.ZodOptional<z.ZodString>;
    PROXY_PORT: z.ZodOptional<z.ZodString>;
    PROXY_USERNAME: z.ZodOptional<z.ZodString>;
    PROXY_PASSWORD: z.ZodOptional<z.ZodString>;
    NODE_ENV: z.ZodString;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: string;
    CAPTCHA_TOKEN?: string | undefined;
    SCRAPPER_BROWSER_WS?: string | undefined;
    PROXY_SERVER?: string | undefined;
    PROXY_PORT?: string | undefined;
    PROXY_USERNAME?: string | undefined;
    PROXY_PASSWORD?: string | undefined;
}, {
    NODE_ENV: string;
    CAPTCHA_TOKEN?: string | undefined;
    SCRAPPER_BROWSER_WS?: string | undefined;
    PROXY_SERVER?: string | undefined;
    PROXY_PORT?: string | undefined;
    PROXY_USERNAME?: string | undefined;
    PROXY_PASSWORD?: string | undefined;
}>;
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
export declare function validate(config: Record<string, unknown>): {
    config: AppConfig;
};
export declare function getAppConfigStatic(): AppConfig;
export declare const appConfigSymbol: symbol;
//# sourceMappingURL=config.d.ts.map