import dedent from "dedent";

import { ExperimentPrompt } from "../experimenter";
import { type Prediction, PredictionParser } from "./prediction-parser";

export const CONFIDENCE_SPLIT = dedent`
  - 91 - 100 - very confident
  - 81 - 90 - highly confident
  - 71 - 80 - moderately confident
  - 0 - 70 - more confident than not
`;

const predictionParser = new PredictionParser();

export const WeeklyTickerSentimentPredictionPrompt =
  new ExperimentPrompt<Prediction>({
    template: dedent`
You are an expert in analyzing ticker market news insights that can affect a ticker sentiment: bullish, bearish, or neutral.
You have been given a set of recent articles' insights about **{symbol}** from the **past 7 days**.
Please review these insights in combination with current **{symbol}** ticker prices and overall market sentiment
based on the MARKET SENTIMENT section to determine how each piece of news could influence {symbol}'s ticker price in the short term (either negatively or positively).
**Output must be strictly in JSON format** as specified in the OUTPUT FORMAT section.

CURRENT DATE: {currentDate}

---

# YOUR TASK
1. Read each article's insights about {symbol} (in the NEWS ARTICLES section) and identify any that may have a meaningful impact on the ticker price in the short term.
2. Take into account that the prediction should be made for the **following week**, i.e. all the factors that could affect the price in the short term should be weighted more.
3. Produce your conclusions and insights as a structured **JSON response**, **strictly** following the format in the **Output Format** section.
4. Consider {symbol}'s price trend for the last few weeks in the TICKER PRICES section.
5. **Watch out** for all signals that could negatively affect short-term {symbol} price:
    - Market downturn sentiment in MARKET SENTIMENT PREDICTION section
    - **Very negative news** about {symbol}
    - Big short interest in {symbol}
    - Signals indicating {symbol} is **overbought**
    - Deteriorating fundamentals, downgrades, poor earnings, etc.
6. **Watch out** for signals that could positively affect short-term price:
    - High-profile leadership changes
    - Positive forecasts, ratings upgrades, strong earnings
    - Strategic partnerships or acquisitions
    - **Short-term catalysts may outweigh fundamentals**
7. Apply short-term market rules such as:
    - Negative technical signals (e.g., overbought) can **outweigh** positive fundamentals
    - If the market is bullish, even mild positive signals about {symbol} can **outweigh negative news**, and **vice versa**
8. If there is a **contradiction** between the main sentiment and the presence of strong opposing signals (e.g., bullish sentiment despite strong negative news),
   provide an **explanation** in the \`counterSignal\` field.

---

# CRITICAL INSTRUCTIONS
- **Confidence scores** must be integers between 0 and 100, with the following split:
  ${CONFIDENCE_SPLIT}
- The **main prediction** (\`sentiment\`) and the **counterSignal.prediction** must be **opposite**.
    - Example: if \`sentiment\` is \`"bullish"'\`, then \`counterSignal.prediction\` must be \`"bearish"'\`, and vice versa.
    - If no strong opposing signal is found, set \`counterSignal\` to \`null\`.
- The \`signal\` field **must be** \`null\` unless there is a clear **conflict** between sentiment and major signals (news or market conditions).
- Confidence scores must be integers between 0 and 100, based on the following weight rule:
    - **Negative signals** should be **weighted 1.5x more** than equivalent positive ones.
- The ticker **sentiment** must be one of: \`"bullish"'\`, \`"bearish"'\`, or \`"neutral"'\`.
- The \`impact\` of each insight must be \`"positive"\`, \`"negative"\` or \`"neutral"\` toward {symbol}'s sentiment.
- Consider both recent **ticker price history** and overall **market sentiment**.
- You **must account for every article**. Each begins with: \`# ARTICLE TITLE: <title>\` and articles are separated by \`---\`.
- Output must be valid **JSON only**, using the format in the OUTPUT FORMAT section.
  **No additional text or explanation outside the JSON.**
- Do your best to include **a few insights** in the output for better analysis.
- Do **not** mention this prompt or instructions in any field of the JSON output.

---

# OUTPUT FORMAT:
{formatInstructions}

# {symbol} TICKER PRICES
\`\`\`markdown
{quotes}
\`\`\`

# MARKET SENTIMENT PREDICTION
\`\`\`json
{marketPrediction}
\`\`\`

# NEWS INSIGHTS
\`\`\`markdown
{news}
\`\`\`
  `,
    inputVariables: [
      "symbol",
      "news",
      "marketPrediction",
      "quotes",
      "currentDate",
    ],
    partialVariables: {
      formatInstructions: predictionParser.getFormatInstructions(),
      marketPrediction: "",
    },
    outputParser: predictionParser,
  });

export const WeeklyGeneralMarketSentimentPredictionPrompt =
  new ExperimentPrompt<Prediction>({
    template: dedent`
You are an expert in analyzing stock market news insights that can affect stock market condition.
You have been given a set of insights extracted from recent news articles about stocket market from the **past 7 days**.
Please review these insights to determine how each could influence market conditions the **following week** (either negatively or positively).

CURRENT DATE: {currentDate}

# YOUR TASK
1. Read the each news article's insights about stock market (provided below) and identify any insights that may have a meaningful impact on the market condition in the short term.
2. Produce your conclusions and insights as a structured JSON response, **strictly** following the format in the **Output Format** section.

# CRITICAL INSTRUCTIONS
- **Confidence scores** must be integers between 0 and 100, with the following split:
    ${CONFIDENCE_SPLIT}
- The overall market short term **sentiment** must be one of: \`bullish\`, \`bearish\`, or \`neutral\`.
- The **impact** of each insight on the market condition must be either \`positive\` or \`negative\`.
- Be sure to account for every article. Each article's insights begin with \`# ARTICLE TITLE: <title>\` and they are separated by \`---\`.
- Output should be in **JSON format** as specified in the **OUTPUT FORMAT** section.

---

# OUTPUT FORMAT:
{formatInstructions}

# NEWS INSIGHTS
\`\`\`markdown
{news}
\`\`\`
  `,
    inputVariables: ["news", "currentDate"],
    partialVariables: {
      formatInstructions: predictionParser.getFormatInstructions(),
    },
    outputParser: predictionParser,
  });
