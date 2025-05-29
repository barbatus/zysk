import dedent from "dedent";

import { AgentPrompt } from "../experiment.agent";
import { type Prediction, PredictionParser } from "./prediction-parser";

export const CONFIDENCE_SPLIT = dedent`
  - 91 - 100 - very confident
  - 81 - 90 - highly confident
  - 71 - 80 - moderately confident
  - 0 - 70 - more confident than not
`;

const predictionParser = new PredictionParser();

export const TickerSentimentPredictionPrompt = new AgentPrompt<Prediction>({
  template: dedent`
You are an expert in analyzing ticker market news and extracting insights that can affect a ticker sentiment: bullish, bearish, or neutral.
You have been given a set of recent news articles about **{symbol}** from the **past 7 days**.
Please review these articles in combination with current **{symbol}** ticker prices and overall market sentiment based on MARKET SENTIMENT to determine how each piece of news could influence {symbol}'s ticker price this week (either negatively or positively).
Output should be strictly in JSON format as specified in the OUTPUT FORMAT section.

# YOUR TASK
1. Read the news articles about {symbol} (in NEWS ARTICLES section) and identify any insights that may have a meaningful impact on the ticker price in the short term.
2. Produce your conclusions and insights as a structured **JSON response**, **strictly** following the format in the **Output Format** section.
3. Take into account {symbol} quotes from {symbol} TICKER PRICE LAST 2 WEEKS section.
4. **Watch out** for all signals that could negatively affect short term {symbol} ticker price in short term such as:
   - market downturn sentiment in MARKET SENTIMENT section
   - **very negative** news about {symbol} in NEWS ARTICLES section
   - big short interest in {symbol} in NEWS ARTICLES section
   - signs that stock is overbought in NEWS ARTICLES section
   - etc
5.  **Watch out** for all signals that could positively affect short term ticker price:
    - since the goal is to predict ticker sentiment certain signals might have stronger effect over fundamental factors
    - for example, if some high profile person joins the company it might have a positive impact on the stock price in the short term stronger that negative news of tariff being raised
6. If there is a very negative news signal present as described in point 4, but sentiment is bullish, or **vice versa**,
   provide explanation in the **signal** field of the JSON response.

# CRITICAL INSTRUCTIONS
- **Confidence scores** must be integers between 0 and 100, with the following split:
    ${CONFIDENCE_SPLIT}
- The ticker **sentiment** must be one of: "bullish", "bearish", or "neutral".
- The **impact** of each insight on the ticker sentiment must be either "positive" or "negative".
- It is critical to factor in **both** the current {symbol} ticker price and general market sentiment in MARKET SENTIMENT section.
- **Account for every article**, each article begins with \`# Article Title: <title>\`, articles are separated by \`---\`.
- **CRITICAL**: Output should be valid JSON according to the **Output Format** section, with no extra text or commentary outside the JSON.
- Provide at least 10 insights.
- **Due to negative bias**, **negative news** confidence **should** be weighted with a factor of 1.5.
- Provide the \`signal\` field in the output **only** if there is a contradiction: stock price sentiment is **bullish** but there is **very negative news** or **unfavorable** market conditions, or **vice versa**,
  otherwise, the \`signal\` field **should be** \`null\`.

---

# OUTPUT FORMAT:
{formatInstructions}

# {symbol} TICKER PRICE LAST 2 WEEKS
\`\`\`markdown
{quotes}
\`\`\`

# MARKET SENTIMENT
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
});

export const GeneralMarketSentimentPredictionPrompt =
  new AgentPrompt<Prediction>({
    template: dedent`
You are an expert in analyzing stock market news and extracting insights that can affect stock market condition.
You have been given a set of recent news articles about stocket market from the **past 7 days**.
Please review these articles to determine how each piece of news could influence market conditions this week (either negatively or positively).

## Your Task
1. Read the news articles about stocke market (provided below) and identify any insights that may have a meaningful impact on the market condition in short term.
2. Produce your conclusions and insights as a structured JSON response, **strictly** following the format in the **Output Format** section.

## Important Details
- **Confidence scores** must be integers between 0 and 100, with the following split:
    ${CONFIDENCE_SPLIT}
- The overall market short term **sentiment** must be one of: \`bullish\`, \`bearish\`, or \`neutral\`.
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
