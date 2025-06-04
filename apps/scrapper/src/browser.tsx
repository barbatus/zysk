import {
  type Browser,
  type HTTPResponse,
  type PuppeteerError,
} from "puppeteer";
import puppeteer from "puppeteer-extra";
import RecaptchaPlugin from "puppeteer-extra-plugin-recaptcha";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import TurndownService from "turndown";

import { getAppConfigStatic } from "./config";

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

export class PageLoadError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const config = getAppConfigStatic();
const turndown = new TurndownService();
turndown.addRule("removeLinks", {
  filter: ["a"],
  replacement(content) {
    return content;
  },
});

turndown.addRule("cleanup", {
  filter: ["link", "img", "script", "style"],
  replacement() {
    return "";
  },
});

let chrome: Browser | undefined;
async function newBrowserContext(params: {
  useBrowserApi: boolean;
  useProxy?: boolean;
}) {
  const createContext = (browser: Browser) => {
    return browser.createBrowserContext({
      proxyServer:
        useProxy && !useBrowserApi
          ? `${config.proxyServer}:${config.proxyPort}`
          : undefined,
    });
  };

  const { useProxy = true, useBrowserApi = false } = params;
  if (chrome) {
    return createContext(chrome);
  }

  puppeteer.use(StealthPlugin());
  puppeteer.use(
    RecaptchaPlugin({
      provider: {
        id: "2captcha",
        token: config.captchaToken,
      },
      visualFeedback: true,
    }),
  );
  chrome = useBrowserApi
    ? await puppeteer.connect({
        browserWSEndpoint: config.scrapperBrowserWs,
      })
    : await puppeteer.launch({
        headless: true,
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
  return createContext(chrome);
}

export async function newBrowserPage(params: {
  useBrowserApi: boolean;
  useProxy?: boolean;
}) {
  const { useProxy = true, useBrowserApi } = params;

  const context = await newBrowserContext({
    useBrowserApi,
    useProxy,
  });

  const page = await context.newPage();

  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const requestUrl = request.url();
    const isMedia = MEDIA_EXTENSIONS.some((ext) =>
      requestUrl.endsWith(`.${ext}`),
    );
    const isAd = AD_SERVING_DOMAINS.some((domain) =>
      requestUrl.includes(domain),
    );
    if (isMedia || isAd) {
      void request.abort();
    } else {
      void request.continue();
    }
  });

  if (!useBrowserApi) {
    await page.authenticate({
      username: config.proxyUsername!,
      password: config.proxyPassword!,
    });
  }

  const oldGoTo = page.goto.bind(page);
  page.goto = async (url, options) => {
    const result = await oldGoTo(url, options);
    if (!useBrowserApi) {
      await page.solveRecaptchas();
    }
    return result;
  };

  return { page, context };
}

export async function scrapeUrl(params: {
  url: string;
  waitFor?: number;
  timeout?: number;
  convertToMd?: boolean;
  useProxy?: boolean;
  useBrowserApi?: boolean;
}) {
  const {
    url,
    waitFor = 2000,
    timeout = 180_000,
    convertToMd = true,
    useProxy = true,
    useBrowserApi = false,
  } = params;

  const { page, context } = await newBrowserPage({
    useBrowserApi,
    useProxy,
  });

  let response: HTTPResponse | null;
  try {
    response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout,
    });
  } catch (error) {
    if (
      (error as Error).message.includes("ERR_TIMED_OUT") ||
      (error as PuppeteerError).name === "TimeoutError"
    ) {
      throw new PageLoadError(408, (error as Error).message);
    }
    throw error;
  }

  await new Promise((resolve) => { setTimeout(resolve, waitFor) });

  const content = await page.content();
  if (response!.status() !== 200) {
    throw new PageLoadError(response!.status(), content);
  }

  const finalUrl = response!.url();
  await context.close();

  if (convertToMd) {
    return { content: turndown.turndown(content), url: finalUrl };
  }

  return { content, url: finalUrl };
}
