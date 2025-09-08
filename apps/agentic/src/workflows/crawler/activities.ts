import { StockNewsSource } from "@zysk/db";
import {
  CrawlerService,
  getLogger,
  resolve,
  TickerNewsService,
} from "@zysk/services";
import { format, startOfDay } from "date-fns";

async function getYahooNews(from: Date, to?: Date) {
  const crawlService = resolve(CrawlerService);
  const currentDateString = format(from, "yyyy-MM-dd");
  const links = await crawlService.sitemapLinks({
    domain: "https://finance.yahoo.com",
    filters: [
      {
        sitemaps: [
          {
            segment: `finance-sitemap_articles_${currentDateString}_US_en-US.xml.gz`,
            isFirst: false,
            level: 1,
          },
        ],
      },
    ],
    from,
    to,
  });
  return links;
}

async function getMarketWatchNews(from: Date, to?: Date) {
  const crawlService = resolve(CrawlerService);
  const links = await crawlService.sitemapLinks({
    domain: "https://marketwatch.com",
    filters: [
      {
        sitemaps: [
          {
            segment: `mw_news_sitemap.xml`,
            isFirst: true,
            level: 0,
          },
        ],
        links: [
          {
            segment: `data-news`,
            isFirst: true,
          },
        ],
      },
    ],
    from,
    to,
  });
  return links;
}

async function getSeekingAlphaNews(from: Date, to?: Date) {
  const crawlService = resolve(CrawlerService);
  const currentMonthString = format(from, "yyyy_M");
  const links = await crawlService.sitemapLinks({
    domain: "https://seekingalpha.com",
    filters: [
      {
        sitemaps: [
          {
            segment: `news`,
            isFirst: true,
            level: 0,
          },
          {
            segment: `${currentMonthString}.xml`,
            isFirst: false,
            level: 1,
          },
        ],
      },
      {
        sitemaps: [
          {
            segment: `article`,
            isFirst: true,
            level: 0,
          },
          {
            segment: `${currentMonthString}.xml`,
            isFirst: false,
            level: 1,
          },
        ],
      },
    ],
    from,
    to,
  });
  return links;
}

const domainToNewsLinksApi = {
  "finance.yahoo.com": getYahooNews,
  "marketwatch.com": getMarketWatchNews,
  "seekingalpha.com": getSeekingAlphaNews,
} as Record<string, (from: Date, to?: Date) => Promise<string[]>>;

export async function getNewsLinks(domain: string) {
  const logger = getLogger();
  const from = startOfDay(new Date());
  if (domain in domainToNewsLinksApi) {
    const links = await domainToNewsLinksApi[domain](from);
    logger.info(
      { links: links.length, domain },
      "[crawlDomain] news links extracted for domain",
    );
    return links.map((l) => ({
      url: l,
      newsDate: new Date(),
      source: StockNewsSource.Octopus,
    }));
  }
  throw new Error(`No news defined for domain: ${domain}`);
}

export async function getNewsSources() {
  const tickerNewsService = resolve(TickerNewsService);
  const sources = await tickerNewsService.getNewsSources();
  return sources;
}
