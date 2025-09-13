export enum PredictionType {
  Weekly = "weekly",
  Daily = "daily",
}

export enum StockNewsStatus {
  Pending = "pending",
  Scraped = "scraped",
  InsightsExtracted = "insights_extracted",
  Failed = "failed",
}

export enum StockNewsSource {
  Finnhub = "finnhub",
  Octopus = "octopus",
}

export enum StockNewsSentiment {
  Positive = "positive",
  Negative = "negative",
  Neutral = "neutral",
  Mixed = "mixed",
}

export interface StockNewsInsight {
  symbols: string[];
  sectors: string[];
  insight: string;
  impact: string;
}
