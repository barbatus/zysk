import {
  type BrowserContextOptions,
  type Request as PlaywrightRequest,
  type Route,
} from "playwright";
import { chromium } from "playwright-extra";
import { connect } from "puppeteer-core";
import RecaptchaPlugin from "puppeteer-extra-plugin-recaptcha";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import TurndownService from "turndown";
import UserAgent from "user-agents";

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

export async function scrapeUrlCustom(params: {
  url: string;
  waitFor?: number;
  timeout?: number;
  convertToMd?: boolean;
  useProxy?: boolean;
}) {
  const config = getAppConfigStatic();

  const {
    url,
    waitFor,
    timeout,
    convertToMd = false,
    useProxy = false,
  } = params;
  chromium.use(StealthPlugin());

  if (config.captchaToken) {
    chromium.use(
      RecaptchaPlugin({
        provider: {
          id: "2captcha",
          token: config.captchaToken,
        },
        visualFeedback: true,
      }),
    );
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
    ],
  });

  const userAgent = new UserAgent().toString();
  const viewport = { width: 1280, height: 800 };

  const contextOptions: BrowserContextOptions = {
    userAgent,
    viewport,
  };

  if (useProxy && config.proxyServer) {
    contextOptions.proxy = {
      server: config.proxyServer,
      username: config.proxyUsername,
      password: config.proxyPassword,
    };
  }

  const context = await browser.newContext(contextOptions);

  await context.route(
    "**/*.{png,jpg,jpeg,gif,svg,mp3,mp4,avi,flac,ogg,wav,webm}",
    async (route: Route, _request: PlaywrightRequest) => {
      await route.abort();
    },
  );

  // Intercept all requests to avoid loading ads
  await context.route("**/*", (route: Route, request: PlaywrightRequest) => {
    const requestUrl = new URL(request.url());
    const hostname = requestUrl.hostname;

    if (AD_SERVING_DOMAINS.some((domain) => hostname.includes(domain))) {
      return route.abort();
    }
    return route.continue();
  });

  const page = await context.newPage();
  await page.goto(url, { timeout });

  const recaptchas = await page.findRecaptchas();
  if (config.captchaToken && recaptchas.captchas.length > 0) {
    await page.solveRecaptchas();
  }

  if (waitFor) {
    await page.waitForTimeout(waitFor);
  }

  const content = await page.content();
  const finalUrl = page.url();
  await context.close();
  await browser.close();

  if (convertToMd) {
    return { content: turndown.turndown(content), url: finalUrl };
  }

  return { content, url: finalUrl };
}

export async function scrapeViaBrowserApi(params: {
  url: string;
  convertToMd?: boolean;
  waitFor?: number;
  timeout?: number;
}) {
  const config = getAppConfigStatic();
  const { url, convertToMd = true, waitFor, timeout } = params;
  const browser = await connect({
    browserWSEndpoint: config.scrapperBrowserWs,
  });

  const page = await browser.newPage();
  await page.goto(url, { timeout });

  // eslint-disable-next-line no-promise-executor-return
  await new Promise((resolve) => setTimeout(resolve, waitFor));

  const content = await page.content();
  const finalUrl = page.url();

  await page.close();
  await browser.close();

  if (convertToMd) {
    return { content: turndown.turndown(content), url: finalUrl };
  }

  return { content, url: finalUrl };
}

export async function scrapeUrl(params: {
  url: string;
  useBrowserApi?: boolean;
  useProxy?: boolean;
  convertToMd?: boolean;
  waitFor?: number;
  timeout?: number;
}) {
  const {
    url,
    useBrowserApi = true,
    convertToMd = true,
    waitFor = 2000,
    timeout = 180_000,
    useProxy,
  } = params;

  if (useBrowserApi) {
    return scrapeViaBrowserApi({ url, convertToMd, waitFor, timeout });
  }

  return scrapeUrlCustom({ url, convertToMd, waitFor, timeout, useProxy });
}
