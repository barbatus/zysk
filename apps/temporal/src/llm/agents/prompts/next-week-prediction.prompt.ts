import dedent from "dedent";

import { AgentPrompt } from "../experiment.agent";
import { type Prediction, PredictionParser } from "./prediction-parser";

const predictionParser = new PredictionParser();

export const nextWeekTicketMarketPredictionPrompt = new AgentPrompt<Prediction>(
  {
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
{quotes}
\`\`\`

# MARKET PREDICTION FOR NEXT WEEK
\`\`\`json
{marketPrediction}
\`\`\`

# NEWS ARTICLES
\`\`\`markdown
{news}
\`\`\`
  `,
    inputVariables: ["symbol", "news", "marketPrediction", "quotes"],
    partialVariables: {
      formatInstructions: predictionParser.getFormatInstructions(),
    },
    outputParser: predictionParser,
  },
);

export const nextWeekGeneralMarketPredictionPrompt =
  new AgentPrompt<Prediction>({
    template: dedent`
You are an expert in analyzing stock market news and extracting insights that can affect stock market condition.
You have been given a set of recent news articles about stocket market from the **past week**.
Please review these articles to determine how each piece of news could influence market conditions in the next **5 working days** (either negatively or positively).

## Your Task
1. Read the news articles about stocke market (provided below) and identify any insights that may have a meaningful impact on the market condition in the **next week (5 days)**.
2. Produce your conclusions and insights as a structured JSON response, **strictly** following the format in the **Output Format** section.

## Important Details
- **Confidence scores** must be integers between 0 and 100.
- The overall market **prediction** for the upcoming week must be one of: \`grow\`, \`fall\`, or \`same\`.
- The **impact** of each insight on the market condition must be either \`positive\` or \`negative\`.
- Be sure to account for every article. Each article begins with \`# ARTICLE TITLE: <title>\` and they are separated by \`---\`.
- CRITICAL Output should be in JSON format as specified in the OUTPUT FORMAT section.

---

# OUTPUT FORMAT:
{formatInstructions}

# NEWS ARTICLES
\`\`\`markdown
{news}
\`\`\`
  `,
    inputVariables: ["news"],
    partialVariables: {
      formatInstructions: predictionParser.getFormatInstructions(),
    },
    outputParser: predictionParser,
  });
