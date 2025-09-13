"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageLoadError = void 0;
exports.isBrowserHealthy = isBrowserHealthy;
exports.newBrowserPages = newBrowserPages;
exports.scrapeUrls = scrapeUrls;
const services_1 = require("@zysk/services");
const puppeteer_extra_1 = __importDefault(require("puppeteer-extra"));
const puppeteer_extra_plugin_recaptcha_1 = __importDefault(require("puppeteer-extra-plugin-recaptcha"));
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
const turndown_1 = __importDefault(require("turndown"));
const config_1 = require("./config");
const AD_SERVING_DOMAINS = [
    "doubleclick.net",
    "adservice.google.com",
    "googlesyndication.com",
    "googletagservices.com",
    "googletagmanager.com",
    "google-analytics.com",
    "adsystem.com",
    "adservice.com",
    "adnxs.com",
    "ads-twitter.com",
    "facebook.net",
    "fbcdn.net",
    "amazon-adsystem.com",
];
const MEDIA_EXTENSIONS = [
    "png",
    "jpg",
    "jpeg",
    "gif",
    "svg",
    "mp3",
    "mp4",
    "avi",
    "flac",
    "ogg",
    "wav",
    "webm",
    "css",
];
class PageLoadError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
exports.PageLoadError = PageLoadError;
const config = (0, config_1.getAppConfigStatic)();
const turndown = new turndown_1.default();
turndown.addRule("removeLinks", {
    filter: ["a"],
    replacement(content) {
        return content;
    },
});
turndown.addRule("cleanup", {
    filter: ["link", "img", "script", "style", "ul"],
    replacement() {
        return "";
    },
});
async function isBrowserHealthy(browser) {
    try {
        if (!browser.connected) {
            return false;
        }
        await browser.version();
        return true;
    }
    catch (error) {
        console.warn("Browser health check failed:", error);
        await browser.close();
        return false;
    }
}
async function newBrowser(params) {
    const { timeout } = params;
    puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_stealth_1.default)());
    puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_recaptcha_1.default)({
        provider: {
            id: "2captcha",
            token: config.captchaToken,
        },
        visualFeedback: true,
    }));
    const chrome = await puppeteer_extra_1.default.launch({
        headless: true,
        protocolTimeout: timeout,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--disable-gpu",
            "--disable-software-rasterizer",
            "--mute-audio",
        ],
    });
    return chrome;
}
async function newBrowserContext(params) {
    const createContext = (browser) => {
        return browser.createBrowserContext({
            proxyServer: useProxy
                ? `${config.proxyServer}:${config.proxyPort}`
                : undefined,
        });
    };
    const browser = await newBrowser({});
    const { useProxy = true } = params;
    return {
        context: await createContext(browser),
        browser,
    };
}
async function newBrowserPages(params) {
    const { context, pages } = params;
    const createPage = async () => {
        const page = await context.newPage();
        await page.setRequestInterception(true);
        page.on("request", (request) => {
            const requestUrl = request.url();
            const isMedia = MEDIA_EXTENSIONS.some((ext) => requestUrl.endsWith(`.${ext}`));
            const isAd = AD_SERVING_DOMAINS.some((domain) => requestUrl.includes(domain));
            if (isMedia || isAd) {
                void request.abort();
            }
            else {
                void request.continue();
            }
        });
        await page.authenticate({
            username: config.proxyUsername,
            password: config.proxyPassword,
        });
        const oldGoTo = page.goto.bind(page);
        page.setDefaultNavigationTimeout(180_000);
        page.goto = async (url, options) => {
            const result = await oldGoTo(url, options);
            await page.solveRecaptchas();
            return result;
        };
        return page;
    };
    return {
        pages: await Promise.all(Array.from({ length: pages }, createPage)),
    };
}
async function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
const logger = (0, services_1.getLogger)();
async function scrapeUrl(params) {
    const { url, page, timeout, waitFor, convertToMd } = params;
    let response;
    const visitPage = async () => {
        try {
            response = await page.goto(url, {
                waitUntil: "domcontentloaded",
                timeout,
            });
        }
        catch (error) {
            if (error.message.includes("ERR_TIMED_OUT") ||
                error.message.includes("ERR_NETWORK_CHANGED") ||
                error.message.includes("ERR_SOCKET_NOT_CONNECTED") ||
                error.name === "TimeoutError") {
                throw new PageLoadError(408, error.message);
            }
            throw error;
        }
        await new Promise((resolve) => {
            setTimeout(resolve, waitFor);
        });
        const content = await page.content();
        if (response.status() !== 200) {
            throw new PageLoadError(response.status(), "Page failed to load");
        }
        const finalUrl = response.url();
        logger.info({
            finalUrl,
        }, "Page loaded successfully");
        if (convertToMd) {
            return { content: turndown.turndown(content), url: finalUrl };
        }
        return { content, url: finalUrl };
    };
    let count = 0;
    while (count < 3) {
        try {
            return await visitPage();
        }
        catch (error) {
            if (error instanceof PageLoadError &&
                (error.status === 408 ||
                    error.status === 401 ||
                    error.status === 403 ||
                    error.status === 429)) {
                count++;
                const ms = Math.pow(2, count - 1) * 30_000;
                logger.warn({
                    url,
                    status: error.status,
                }, `[Scrapper] Retrying page.goto in ${Math.round(ms / 1000)} seconds`);
                await sleep(ms);
                continue;
            }
            throw error;
        }
    }
    throw new PageLoadError(408, "Page failed to load");
}
async function scrapeUrls(params) {
    const { urls, waitFor = 2000, timeout = 180_000, convertToMd = true, useProxy = true, } = params;
    const { browser, context } = await newBrowserContext({
        useProxy,
    });
    const { pages } = await newBrowserPages({
        pages: urls.length,
        context,
    });
    const results = await Promise.allSettled(pages.map(async (page, index) => {
        const { content, url } = await scrapeUrl({
            url: urls[index],
            page,
            timeout,
            waitFor,
            convertToMd,
        });
        return { content, url };
    }));
    await browser.close();
    return results.map((result, index) => {
        if (result.status === "fulfilled") {
            return result.value;
        }
        return {
            url: urls[index],
            error: result.reason,
        };
    });
}
//# sourceMappingURL=browser.js.map