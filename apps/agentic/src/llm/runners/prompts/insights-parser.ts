import { z, ZodError } from "zod";

import { JsonOutputParser, ParserError } from "./parsers";

const NewsInsightSchema = z.object({
  acticleId: z.string(),
  title: z.string(),
  description: z.string(),
  mainSymbol: z.string().optional(),
  extractedSymbols: z.array(z.string()).optional().default([]),
  impact: z
    .enum(["positive", "negative", "neutral", "mixed"])
    .optional()
    .default("neutral"),
  insights: z.array(
    z.object({
      insight: z.string(),
      impact: z
        .enum(["positive", "negative", "neutral", "mixed"])
        .optional()
        .default("neutral"),
      symbols: z.array(z.string()).optional().default([]),
      sectors: z.array(z.string()).optional().default([]),
      longTerm: z.boolean().optional().default(false),
    }),
  ),
});

const InsightsSchema = z.array(NewsInsightSchema);

export type NewsInsight = z.infer<typeof NewsInsightSchema>;

export type Insights = z.infer<typeof InsightsSchema>;

export class InsightsParser extends JsonOutputParser<Insights> {
  override async parse(response: string): Promise<Insights> {
    try {
      const json = await super.parse(
        response.replace(/<think>.*?<\/think>/gs, ""),
      );
      const result = InsightsSchema.parse(json);
      return result;
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
You must provide output as JSON array with the following structure,
each array item is a news article with insights.
\`\`\`json
  [
    {
        "acticleId": "ID of the news article from the article heading",
        "title": "descriptive title of the news article",
        "description": "brief description of the news article",
        "mainSymbol": "main ticker symbol of the news article",
        "impact": "sentiment of the news article, one of: positive, negative, neutral, mixed",
        "extractedSymbols": "list of ticker symbols of the companies mentioned in the article, if any",
        "insights": [
          {
            "insight": "description of the insight",
            "impact": "impact on the stock price as lower case values from: positive, negative, mixed, neutral",
            "symbols": "list of ticker symbols this insight is about if any",
            "sectors": "list of sectors this insight is about if any, if it's about general market use 'GENERAL' value",
            "longTerm": "true if the insight can be used for long term analysis, i.e. 6 months or more, otherwise false",
          }
        ]
    },
    ...
  ]
\`\`\`
    `;
  }
}
