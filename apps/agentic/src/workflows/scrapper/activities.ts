import { activityInfo } from "@temporalio/activity";
import { ApplicationFailure } from "@temporalio/workflow";
import { type StockNewsInsert } from "@zysk/db";
import { StockNewsStatus } from "@zysk/db";
import {
  PageLoadError,
  scrapeUrls as scrapeUrlsViaBrowser,
} from "@zysk/scrapper";
import {
  type Exact,
  getLogger,
  resolve,
  TickerNewsService,
} from "@zysk/services";
import { mapKeys, omit, uniqBy } from "lodash";
// eslint-disable-next-line camelcase
import { encoding_for_model } from "tiktoken";

import { memoizeScrapperUrls } from "../../utils/redis";

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

  const format = convertToMd ? "md" : "html";

  return await memoizeScrapperUrls(
    urls,
    format,
    async (urlsToScrape: string[]) => {
      const tickerNewsService = resolve(TickerNewsService);
      const result = await (
        viaApi
          ? tickerNewsService.scrapeUrls.bind(tickerNewsService)
          : scrapeUrlsViaBrowser
      )({
        urls: urlsToScrape,
        useProxy,
        convertToMd,
        waitFor,
        timeout,
      });
      return result;
    },
  );
}

export async function getOrScrapeNews(
  news: {
    url: string;
    title?: string;
    newsDate: Date;
  }[],
) {
  const tickerNewsService = resolve(TickerNewsService);
  const savedNews = uniqBy(
    (await tickerNewsService.getArticles(news.map((n) => n.url))).map((n) => ({
      url: n.url,
      markdown: n.markdown,
      title: n.title,
      originalUrl: n.originalUrl,
      status: n.status,
      newsDate: n.newsDate,
    })),
    (n) => n.url,
  ) as {
    url: string;
    markdown?: string;
    title?: string;
    error?: Error;
    originalUrl: string;
    status: StockNewsStatus;
    newsDate: Date;
  }[];

  const newsByUrl = mapKeys(news, "url");

  const savedNewsByUrl = mapKeys(savedNews, "originalUrl");

  const urlsToScrape = news
    .filter((n) => !(n.url in savedNewsByUrl))
    .map((n) => n.url);

  const result = (await scrapeUrls({ urls: urlsToScrape })).map((r, index) => ({
    ...r,
    originalUrl: urlsToScrape[index],
    title: newsByUrl[urlsToScrape[index]].title,
    newsDate: newsByUrl[urlsToScrape[index]].newsDate,
  }));

  const failedNews = result.filter((n) => Boolean(n.error));
  const logger = getLogger();

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
      status: r.error ? StockNewsStatus.Failed : StockNewsStatus.Scraped,
    })),
  );
}

export async function scrapeNews(
  urls: {
    url: string;
    title?: string;
    newsDate: Date;
  }[],
  maxTokens = 5000,
) {
  if (urls.length === 0) {
    throw ApplicationFailure.create({
      type: "ScrapeError",
      message: "URLs should not be empty",
      nonRetryable: true,
    });
  }

  const result = await getOrScrapeNews(urls);

  const tokenizer = encoding_for_model("gpt-4o");
  const cleanedNews = result.map((r) => {
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
        tokenSize: slicedTokens.length,
      };
    }
    return {
      ...r,
      url: r.url,
      tokenSize: 0,
    };
  });

  tokenizer.free();

  const successfulUrls = cleanedNews.filter((n) => !n.error).length;
  const total = cleanedNews.length;
  const successRate = Math.round((successfulUrls / total) * 100);
  const logger = getLogger();

  logger.info(
    {
      successfulUrls,
      total,
    },
    "[scrapeNews] Result",
  );

  if (successRate >= 85) {
    return cleanedNews;
  }

  const attempt = activityInfo().attempt;
  if (attempt <= 2) {
    throw ApplicationFailure.create({
      type: "ScrapeError",
      message: `Success rate of the scraping is ${successRate}% lower than 85%`,
      nonRetryable: false,
      nextRetryDelay: "1m",
    });
  }

  return cleanedNews;
}

export async function scrapeTickerNewsUrlsAndSave(params: {
  symbol?: string;
  news: { newsDate: Date; url: string; title?: string }[];
}) {
  const { symbol, news } = params;
  const logger = getLogger();

  if (news.length === 0) {
    logger.error({ symbol }, "No news to scrape");
    return [];
  }

  const itemByUrl = mapKeys(news, "url");
  const result = await scrapeNews(news).then((r) =>
    r.map((n) => ({
      ...itemByUrl[n.url],
      ...omit(n, "error"),
      markdown: n.error ? n.error.message : n.markdown,
      symbol,
    })),
  );

  const uniqueNews = uniqBy(result, (n) =>
    n.symbol ? `${n.symbol}-${n.url}` : n.url,
  );

  return (await saveNews(uniqueNews)).map((n) => ({
    id: n.id,
    status: n.status,
  }));
}

export async function saveNews<T extends StockNewsInsert>(
  news: Exact<T, StockNewsInsert>[],
) {
  const tickerNewsService = resolve(TickerNewsService);
  return tickerNewsService.saveNews(news);
}
