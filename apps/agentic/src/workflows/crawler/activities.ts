import { StockNewsSource } from "@zysk/db";
import {
  CrawlerService,
  getLogger,
  resolve,
  TickerNewsService,
} from "@zysk/services";
import { format } from "date-fns";

async function getYahooNews() {
  const crawlService = resolve(CrawlerService);
  const currentDateString = format(new Date(), "yyyy-MM-dd");
  const links = await crawlService.sitemapLinks("https://finance.yahoo.com", {
    sitemaps: [
      {
        segment: `finance-sitemap_articles_${currentDateString}_US_en-US.xml.gz`,
        isFirst: false,
        level: 1,
      },
    ],
  });
  return links;
}

const domainToNewsLinksApi = {
  "finance.yahoo.com": getYahooNews,
} as Record<string, () => Promise<string[]>>;

export async function getNewsLinks(domain: string) {
  const logger = getLogger();
  if (domain in domainToNewsLinksApi) {
    const links = await domainToNewsLinksApi[domain]();
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
