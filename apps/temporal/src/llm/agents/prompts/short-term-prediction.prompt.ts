import dedent from "dedent";
import { z } from "zod";

import { AgentPrompt } from "../experiment.agent";
import { JsonOutputParser } from "./parsers";

const SignalSchema = z.object({
  description: z.string(),
  prediction: z.enum(["grow", "fall", "same"]),
  confidence: z.number(),
});

const InsightSchema = z.object({
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
  signal: SignalSchema.optional().nullable(),
  reasoning: z.string(),
  confidence: z.number(),
  insights: z.array(InsightSchema),
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
        "signal": {
            "description": "description of the signal that stock price will grow despite unfavorable market conditions or some very negative news, or vice versa, stock price will fall despite favorable market conditions or some very positive news",
            "prediction": "should be 'grow' if overall prediction is 'fall' and vice versa",
            "confidence": "confidence score (0-100)"
        },
        "insights": [
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

const predictionParser = new PredictionParser();

export const shortTermPredictionPrompt = new AgentPrompt<Prediction>({
  template: dedent`
You are an expert in analyzing stock market news and extracting insights that can affect a stock price.
You have been given a set of recent news articles about **{symbol}** from the **past week**.
Please review these articles in combination with current **{symbol}** stock prices and overall market conditions based on MARKET PROGNOSIS LAST WEEK to determine how each piece of news could influence {symbol}'s stock price in the next **5 working days** (either negatively or positively).
Output should be strictly in JSON format as specified in the OUTPUT FORMAT section.

# YOUR TASK
1. Read the news articles about {symbol} (in NEWS ARTICLES section) and identify any insights that may have a meaningful impact on the stock price in the **next week (5 days)**.
2. Produce your conclusions and insights as a structured **JSON response**, **strictly** following the format in the **Output Format** section.
3. Take into account {symbol} STOCK PRICE LAST 2 WEEKS data.
4. **Watch out** for all signals that could negatively affect short term stock price of {symbol} such as:
   - market downturn prediction in **MARKET PROGNOSIS LAST WEEK**
   - **very negative** news about {symbol} in **NEWS ARTICLES**
   - big short interest in {symbol} in **NEWS ARTICLES**
   - signs that stock is overbought in **NEWS ARTICLES**
   - etc
5. If there is a very negative news signal present as described in point 4, but prediction for growth is still positive, or **vice versa**,
   provide explanation in the **signal** field of the JSON response.

# CRITICAL INSTRUCTIONS
- **Confidence scores** must be integers between 0 and 100.
- The overall stock price **prediction** for the upcoming week must be one of: "grow", "fall", or "same".
- The **impact** of each insight on the stock price must be either "positive" or "negative".
- It is critical to factor in **both** the current {symbol} stock prices and general market conditions prognosis in MARKET PROGNOSIS LAST WEEK section.
- **Account for every article**, each article begins with \`# Article Title: <title>\`, articles are separated by \`---\`.
- **CRITICAL**: Output should be valid JSON according to the **Output Format** section, with no extra text or commentary outside the JSON.
- Provide at least 10 insights.
- **Due to negative bias**, **negative news** confidence **should** be weighted with a factor of 1.5.
- Provide the \`signal\` field in the output **only** if there is a contradiction: stock price prediction is **grow** but there is **very negative news** or **unfavorable** market conditions, or **vice versa**,
  otherwise, the \`signal\` field **should be** \`null\`.

---

# OUTPUT FORMAT:
{formatInstructions}

# {symbol} STOCK PRICE LAST 2 WEEKS
\`\`\`markdown
Apr 25, 2025 - 82.74
Apr 24, 2025 - 79.84
Apr 23, 2025 - 78.74
Apr 22, 2025 - 78.97
Apr 21, 2025 - 77.85
Apr 17, 2025 - 78.0
Apr 16, 2025 - 76.46
Apr 15, 2025 - 78.39
Apr 14, 2025 - 79.17
Apr 13, 2025 - 79.18
Apr 12, 2025 - 77.55
\`\`\`

# MARKET PROGNOSIS FOR NEXT WEEK
\`\`\`markdown
{marketPrognosis}
\`\`\`

# NEWS ARTICLES
\`\`\`markdown
{news}
\`\`\`
  `,
  inputVariables: ["symbol", "news", "marketPrognosis"],
  partialVariables: {
    formatInstructions: predictionParser.getFormatInstructions(),
  },
  outputParser: predictionParser,
});
