import axios from "axios";
import { format } from "date-fns";
import { inject, injectable } from "inversify";

import { type AppConfig, appConfigSymbol } from "./config";

const finnhubApiUrl = "https://finnhub.io/api/v1";

@injectable()
export class FinnhubService {
  constructor(@inject(appConfigSymbol) private readonly appConfig: AppConfig) {}

  async fetchUSTickers(symbols: string[]) {
    const response = await axios.get<
      {
        displaySymbol: string;
        symbol: string;
        type: "Common Stock" | "ETP" | "REIT" | "ADR";
        description: string;
        figi: string;
        currency: string;
        isin: string;
        mic: string;
        shareClassFIGI: string;
        symbol2?: string;
      }[]
    >(`${finnhubApiUrl}/stock/symbol`, {
      params: {
        exchange: "US",
        token: this.appConfig.finnhubApiKey,
      },
    });
    return response.data.filter((d) =>
      symbols.length ? symbols.includes(d.symbol) : true,
    );
  }

  async fetchTickerNews(params: {
    symbol: string;
    startDate: Date;
    endDate?: Date;
  }): Promise<{ url: string; title: string; newsDate: Date }[]> {
    const { symbol, startDate, endDate } = params;
    const from = format(startDate, "yyyy-MM-dd");
    const to = format(endDate ?? new Date(), "yyyy-MM-dd");
    const path = symbol.toLowerCase() === "general" ? "news" : "company-news";
    const response = await axios.get<
      {
        id: number;
        datetime: number;
        headline: string;
        source: string;
        url: string;
      }[]
    >(
      `${finnhubApiUrl}/${path}?symbol=${symbol}&from=${from}&to=${to}&token=${this.appConfig.finnhubApiKey}`,
    );
    return response.data.map((d) => ({
      url: d.url,
      title: d.headline,
      newsDate: new Date(d.datetime * 1000),
    }));
  }

  async fetchQuote(symbol: string) {
    const response = await axios.get<{
      c: number;
      d: number;
      dp: number;
      h: number;
      l: number;
      o: number;
      pc: number;
    }>(
      `${finnhubApiUrl}/quote?symbol=${symbol}&token=${this.appConfig.finnhubApiKey}`,
    );
    return response.data;
  }
}
