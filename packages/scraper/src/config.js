"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appConfigSymbol = exports.AppConfigEnvVariablesSchema = void 0;
exports.validate = validate;
exports.getAppConfigStatic = getAppConfigStatic;
require("dotenv/config");
const zod_1 = require("zod");
exports.AppConfigEnvVariablesSchema = zod_1.z.object({
    CAPTCHA_TOKEN: zod_1.z.string().optional(),
    SCRAPPER_BROWSER_WS: zod_1.z.string().optional(),
    PROXY_SERVER: zod_1.z.string().optional(),
    PROXY_PORT: zod_1.z.string().optional(),
    PROXY_USERNAME: zod_1.z.string().optional(),
    PROXY_PASSWORD: zod_1.z.string().optional(),
    NODE_ENV: zod_1.z.string(),
});
function validate(config) {
    const appConfigValidated = exports.AppConfigEnvVariablesSchema.parse(config);
    const appConfig = {
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
let appConfigStatic;
function getAppConfigStatic() {
    if (appConfigStatic !== undefined) {
        return appConfigStatic;
    }
    const parsedAppConfig = validate(process.env);
    appConfigStatic = parsedAppConfig.config;
    return appConfigStatic;
}
exports.appConfigSymbol = Symbol.for("AppConfig");
//# sourceMappingURL=config.js.map