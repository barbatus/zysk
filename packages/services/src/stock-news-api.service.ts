import axios, { type AxiosError } from "axios";
import { startOfDay } from "date-fns";
import { inject, injectable } from "inversify";
import { omit } from "lodash";

import { type AppConfig, appConfigSymbol } from "./config";

@injectable()
export class StockNewsApiService {
  constructor(@inject(appConfigSymbol) private readonly appConfig: AppConfig) {}

  async getTickerNews({
    symbol,
    section,
    sinceDate,
  }: {
    symbol?: string;
    section?: string;
    sinceDate: Date;
  }) {
    // Basic plan supports only 5 pages
    const result = await Promise.all(
      Array.from({ length: 5 }).map((_, page) =>
        this.getStockNewsApiPage({ symbol, section, page: page + 1 }).then(
          (n) => n.filter((a) => a.newsDate >= sinceDate),
        ),
      ),
    );
    return result.flat();
  }

  private async getStockNewsApiPage(params: {
    symbol?: string;
    section?: string;
    page: number;
  }) {
    const { symbol: tickers, section, page } = params;
    const path = section ? `/category` : "";
    return axios
      .get<{
        data: {
          news_url: string;
          date: string;
          title: string;
        }[];
      }>(`https://stocknewsapi.com/api/v1${path}`, {
        params: {
          tickers,
          section,
          items: 100,
          token: this.appConfig.stockNewsApiKey,
          page,
        },
      })
      .then(({ data }) =>
        data.data.map((n) => ({
          ...omit(n, "news_url", "date"),
          url: n.news_url,
          newsDate: new Date(n.date),
        })),
      )
      .catch((e) => {
        if (
          (e as AxiosError<{ message?: string }>).response?.status === 403 &&
          (
            e as AxiosError<{ message?: string }>
          ).response?.data.message?.includes(
            "Basic plans can query up to 5 pages",
          )
        ) {
          return [] as {
            url: string;
            title: string;
            newsDate: Date;
          }[];
        }
        throw e;
      });
  }

  async getTodayNews(symbol: string) {
    return this.getTickerNews({ symbol, sinceDate: startOfDay(new Date()) });
  }
}
