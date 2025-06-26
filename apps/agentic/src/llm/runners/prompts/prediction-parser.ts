import { z, ZodError } from "zod";

import { JsonOutputParser, ParserError } from "./parsers";

const SignalSchema = z.object({
  description: z.string(),
  prediction: z.enum(["bullish", "bearish", "neutral"]),
  confidence: z.number(),
});

const NewsInsightSchema = z.object({
  title: z.string(),
  date: z.string(),
  url: z.string(),
  insight: z.string(),
  impact: z.enum(["positive", "negative", "mixed", "neutral"]),
  reasoning: z.string(),
  confidence: z.number(),
});

const PredictionSchema = z.object({
  symbol: z.string(),
  prediction: z.enum(["bullish", "bearish", "neutral"]),
  counterSignal: SignalSchema.optional().nullable(),
  reasoning: z.string(),
  confidence: z.number(),
  newsInsights: z.array(NewsInsightSchema),
});

export type Prediction = z.infer<typeof PredictionSchema>;

export class PredictionParser extends JsonOutputParser<Prediction> {
  override async parse(response: string): Promise<Prediction> {
    try {
      return PredictionSchema.parse(await super.parse(response));
    } catch (error) {
      const issue = error instanceof ZodError ? error.issues[0] : null;
      throw new ParserError(
        issue
          ? `${issue.code}: ${String(issue.path)}: ${issue.message}`
          : (error as Error).message,
      );
    }
  }

  override getFormatInstructions(): string {
    return `
You must provide output as a single JSON object with the following structure:
\`\`\`json
    {
        "symbol": "ticker symbol or general or sector name",
        "prediction": "sentiment for the stock price: bullish, bearish, neutral",
        "reasoning": "reasoning behind the prediction",
        "confidence": "confidence score (0-100)",
        "counterSignal": {
            "description": "description of the signal that stock price will grow despite unfavorable market conditions or some very negative news, or vice versa, stock price will fall despite favorable market conditions or some very positive news",
            "prediction": "should be \`bullish\` if overall prediction is \`bearish\` and vice versa",
            "confidence": "strength of the signal (0-100), i.e. how strong it can counteract bullish sentiment prediction if it's bearish signal, and vice versa"
        },
        "newsInsights": [
            {
                "title": "title of the article",
                "date": "date of the article",
                "url": "url of the article",
                "insight": "description of the insight",
                "impact": "impact on the stock price: positive, negative, mixed",
                "reasoning": "reasoning behind the impact",
                "confidence": "strength of the insight (0-100), i.e. how strong it can affect bullish sentiment if it's positive insight, and vice versa"
            },
            ...
        ]
    }
\`\`\`
    `;
  }
}
