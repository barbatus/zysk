import { z, ZodError } from "zod";

import { JsonOutputParser, ParserError } from "./parsers";

const NewsInsightSchema = z.object({
  newsId: z.string(),
  symbols: z.array(z.string()),
  sectors: z.array(z.string()),
  title: z.string(),
  date: z.string(),
  url: z.string(),
  insight: z.string(),
  impact: z.string(),
});

const InsightsSchema = z.array(NewsInsightSchema);

export type Insights = z.infer<typeof InsightsSchema>;

export class InsightsParser extends JsonOutputParser<Insights> {
  override async parse(response: string): Promise<Insights> {
    try {
      const json = await super.parse(response.replace(/<think>.*?<\/think>/gs, ""));
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
You must provide output as JSON array with the following structure:
\`\`\`json
  [
    {
        "newsId": "id of the news article",
        "symbols": "list of ticker symbols this insight is about if any",
        "sectors": "list of sectors this insight is about if any, if it's about general market use 'GENERAL' value",
        "title": "title of the article",
        "date": "date of the article",
        "url": "url of the article",
        "insight": "description of the insight",
        "impact": "impact on the stock price as lower case values from: positive, negative, mixed, neutral",
    },
    ...
  ]
\`\`\`
    `;
  }
}
