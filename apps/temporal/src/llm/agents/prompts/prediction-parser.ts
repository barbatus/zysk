import { z } from "zod";

import { JsonOutputParser } from "./parsers";

const SignalSchema = z.object({
  description: z.string(),
  prediction: z.enum(["grow", "fall", "same"]),
  confidence: z.number(),
});

const NewsInsightSchema = z.object({
  title: z.string(),
  date: z.string(),
  url: z.string(),
  insight: z.string(),
  impact: z.enum(["positive", "negative", "mixed"]),
  reasoning: z.string(),
  confidence: z.number(),
});

const PredictionSchema = z.object({
  prediction: z.enum(["grow", "fall", "same"]),
  counterSignal: SignalSchema.optional().nullable(),
  reasoning: z.string(),
  confidence: z.number(),
  newsInsights: z.array(NewsInsightSchema),
});

export type Prediction = z.infer<typeof PredictionSchema>;

export class PredictionParser extends JsonOutputParser<Prediction> {
  override parse(response: string): Promise<Prediction> {
    return Promise.resolve(PredictionSchema.parse(super.parse(response)));
  }

  override getFormatInstructions(): string {
    return `
You must provide output as a single JSON object with the following structure:
\`\`\`json
    {
        "prediction": "prediction for the stock price: grow, fall, same",
        "reasoning": "reasoning behind the prediction",
        "confidence": "confidence score (0-100)",
        "counterSignal": {
            "description": "description of the signal that stock price will grow despite unfavorable market conditions or some very negative news, or vice versa, stock price will fall despite favorable market conditions or some very positive news",
            "prediction": "should be \`grow\` if overall prediction is \`fall\` and vice versa",
            "confidence": "confidence score (0-100)"
        },
        "newsInsights": [
            {
                "title": "title of the article",
                "date": "date of the article",
                "url": "url of the article",
                "insight": "description of the insight",
                "impact": "impact on the stock price: positive, negative, mixed",
                "reasoning": "reasoning behind the impact",
                "confidence": "confidence score (0-100)"
            },
            ...
        ]
    }
\`\`\`
    `;
  }
}
