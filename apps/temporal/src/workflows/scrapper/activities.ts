import { activityInfo } from "@temporalio/activity";
import { ApplicationFailure } from "@temporalio/workflow";
import { type StockNewsInsert } from "@zysk/db";
import {
  PageLoadError,
  scrapeUrls as scrapeUrlsViaBrowser,
} from "@zysk/scrapper";
import {
  type Exact,
  getAppConfigStatic,
  getLogger,
  NodeEnvironment,
  resolve,
  TickerNewsService,
} from "@zysk/services";
import IORedis, { type RedisOptions } from "ioredis";
import { mapKeys, omit } from "lodash";
// eslint-disable-next-line camelcase
import { encoding_for_model } from "tiktoken";

const logger = getLogger();

const config = getAppConfigStatic();

const redisOptions: RedisOptions = {
  host: config.upstash?.redisRestUrl,
  port: 6379,
  username: "default",
  password: config.upstash?.redisRestToken,
  family: 6,
  maxRetriesPerRequest: null,
  tls: {},
};

const redis = new IORedis(
  config.nodeEnv === NodeEnvironment.DEVELOPMENT
    ? {
        host: "localhost",
        port: 6379,
        maxRetriesPerRequest: null,
      }
    : redisOptions,
);

export async function scrapeUrls(params: {
  urls: string[];
  useProxy?: boolean;
  convertToMd?: boolean;
  waitFor?: number;
  timeout?: number;
  viaApi?: boolean;
}) {
  const {
    urls,
    useProxy = true,
    convertToMd = true,
    viaApi = true,
    waitFor,
    timeout,
  } = params;
  const cachedUrls = mapKeys(
    (
      await Promise.allSettled(
        urls.map((url) =>
          redis.get(
            `scrapper:urls:format:${convertToMd ? "md" : "html"}:${url}`,
          ),
        ),
      )
    )
      .map((r, index) => {
        if (r.status === "fulfilled" && r.value) {
          return {
            url: urls[index],
            content: r.value,
          } as {
            url: string;
            content?: string;
            error?: Error;
          };
        }
        return null;
      })
      .filter(Boolean),
    "url",
  );

  const newUrls = urls.filter((url) => !(url in cachedUrls));

  const tickerNewsService = resolve(TickerNewsService);
  const result = await (
    viaApi
      ? tickerNewsService.scrapeUrls.bind(tickerNewsService)
      : scrapeUrlsViaBrowser
  )({
    urls: newUrls,
    useProxy,
    convertToMd,
    waitFor,
    timeout,
  });

  await Promise.allSettled(
    result
      .filter((r) => !r.error && r.content)
      .map((r) =>
        redis.set(
          `scrapper:urls:format:${convertToMd ? "md" : "html"}:${r.url}`,
          r.content!,
          "EX",
          "5 minutes",
        ),
      ),
  );

  return Object.values(cachedUrls).concat(result);
}

export async function getOrScrapeNews(urls: string[]) {
  const tickerNewsService = resolve(TickerNewsService);
  const savedNews = (await tickerNewsService.getArticles(urls)).map((n) => ({
    url: n.url,
    markdown: n.markdown,
    originalUrl: n.originalUrl,
  })) as {
    url: string;
    markdown?: string;
    error?: Error;
    originalUrl: string;
  }[];

  const savedNewsByUrl = mapKeys(savedNews, "originalUrl");

  const urlsToScrape = urls.filter((url) => !(url in savedNewsByUrl));

  const result = (await scrapeUrls({ urls: urlsToScrape })).map((r) => ({
    ...r,
    originalUrl: r.url,
  }));

  const failedNews = result.filter((n) => Boolean(n.error));

  if (failedNews.length) {
    logger.error(
      {
        failedNews: failedNews.map(
          (n) =>
            `${n.url} with status ${
              n.error instanceof PageLoadError ? n.error.status : 500
            }`,
        ),
      },
      "Failed to scrape news",
    );
  }

  return savedNews.concat(
    result.map((r) => ({
      ...omit(r, "content"),
      markdown: r.content,
    })),
  );
}

export async function scrapeNews(urls: string[], maxTokens = 5000) {
  if (urls.length === 0) {
    throw ApplicationFailure.create({
      type: "ScrapeError",
      message: "URLs should not be empty",
      nonRetryable: true,
    });
  }

  const result = await getOrScrapeNews(urls);

  const tokenizer = encoding_for_model("gpt-4o");
  const cleanedNews = result.map((r, index) => {
    if (r.markdown) {
      const cleanedMarkdown = r.markdown
        .replace(/\[.+\]\(.*?\)/gm, "")
        .replace(/(?:\n\n)+/gm, "\n\n");
      const tokens = tokenizer.encode(cleanedMarkdown);
      // Set limit here to 5000 tokens as sometimes it parses more then needed on
      // pages with infinite scrolling, 5000 is enough to get the main content
      const slicedTokens = tokens.slice(0, maxTokens);
      const slicedMarkdown = new TextDecoder().decode(
        tokenizer.decode(slicedTokens),
      );
      return {
        ...r,
        markdown: slicedMarkdown,
        url: r.url,
        originalUrl: urls[index],
        tokenSize: slicedTokens.length,
      };
    }
    return {
      ...r,
      url: r.url,
      originalUrl: urls[index],
      tokenSize: 0,
    };
  });

  tokenizer.free();

  const successfulUrls = cleanedNews.filter((n) => !n.error).length;
  const total = urls.length;
  const successRate = Math.round((successfulUrls / total) * 100);

  logger.info(
    {
      successfulUrls,
      total,
    },
    "[scrapeNews] Result",
  );

  if (successRate >= 80) {
    return cleanedNews;
  }

  const attempt = activityInfo().attempt;
  if (attempt <= 1) {
    throw ApplicationFailure.create({
      type: "ScrapeError",
      message: `Success rate of the scraping is ${successRate}% lower than 80%`,
      nonRetryable: false,
      nextRetryDelay: "1m",
    });
  }

  return cleanedNews;
}

export async function saveNews<T extends StockNewsInsert>(
  news: Exact<T, StockNewsInsert>[],
) {
  const tickerNewsService = resolve(TickerNewsService);
  return tickerNewsService.saveNews(news);
}
