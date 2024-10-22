import axios from "axios";
import { subYears } from "date-fns";

import { db } from "./db";

const stockSymbols = [
  "NVDA",
  "AMZN",
  "META",
  "MSFT",
  "APPL",
  "UBER",
  "INTC",
  "LI",
];

async function fetchAndSaveStockData(symbol: string) {
  try {
    console.log(`Fetching data for ${symbol}...`);
    const response = await axios.get<{
      "Time Series (Daily)": Record<string, Record<string, string>>;
      "Error Message"?: string;
      Note?: string;
    }>("https://www.alphavantage.co/query", {
      params: {
        function: "TIME_SERIES_DAILY",
        symbol,
        apikey: process.env.ALPHA_VANTAGE_API_KEY,
        outputsize: "full",
      },
    });

    const data = response.data;

    if (data["Error Message"] ?? data.Note) {
      console.error(
        `Error fetching data for ${symbol}:`,
        data["Error Message"] ?? data.Note,
      );
      return;
    }

    const timeSeries = data["Time Series (Daily)"];

    const tenYearsAgo = subYears(new Date(), 10);
    const quotes = Object.entries(timeSeries)
      .filter(([dateStr]) => new Date(dateStr) >= tenYearsAgo)
      .map(([dateStr, values]) => {
        return {
          symbol,
          date: new Date(dateStr),
          open_price: parseFloat(values["1. open"]),
          close_price: parseFloat(values["4. close"]),
          high: parseFloat(values["2. high"]),
          low: parseFloat(values["3. low"]),
          volume: parseFloat(values["5. volume"]),
          // split_coeff: parseFloat(values['8. split coefficient']) || null,
          // divident: parseFloat(values['7. dividend amount']) || null,
        };
      });

    for (const quote of quotes) {
      await db
        .insertInto("quote")
        .values(quote)
        .onConflict((oc) => oc.columns(["symbol", "date"]).doUpdateSet(quote))
        .execute();
    }

    console.log(`Data for ${symbol} saved successfully.`);
  } catch (error) {
    console.error(`Failed to fetch or save data for ${symbol}:`, error);
  }
}

async function main() {
  try {
    await Promise.allSettled(
      stockSymbols.map((symbol) => fetchAndSaveStockData(symbol)),
    );
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error("An unexpected error occurred:", error);
});
