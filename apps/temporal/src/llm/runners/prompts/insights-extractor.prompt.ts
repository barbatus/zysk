import dedent from "dedent";

import { ExperimentPrompt } from "../experimenter";
import { type Insights, InsightsParser } from "./insights-parser";

const insightsParser = new InsightsParser();

export const NewsInsightsExtractorPrompt = new ExperimentPrompt<Insights>({
  template: dedent`
You are a financial news analysis expert specializing in extracting **comprehensive, actionable, and structured insights** from stock market news articles.
Each article provides information essential for **detailed sentiment analysis and accurate market forecasting**, with priority given to insights about the specified ticker symbol.

Each article starts with \`# ARTICLE FOR SYMBOL: <symbol>\` and articles are separated by \`---\`.

---

# TASK
For **each news article**, meticulously **extract and thoroughly analyze all potential insights** related explicitly to the designated ticker symbol first.
After fully covering these primary symbol insights, **also comprehensively extract additional insights** that could influence:

- **Other individual stock tickers** (e.g., competitors, suppliers, partners)
- **Industry sectors** (e.g., tech, healthcare, energy)
- **Broader market sentiment** (macroeconomic indicators, geopolitical events, regulatory developments)

---

# GUIDELINES
- **Extract every possible insight**, even minor ones, that could slightly impact short-term or long-term sentiment.
- Clearly **prioritize** and deeply analyze insights directly associated with the primary ticker symbol.
- After primary analysis, include **all relevant insights** about competitors, sectors, or overall market sentiment.
- Clearly separate each insight as individual items in the \`insights\` array.
- **Translate company names** into ticker symbols whenever possible.
- Infer ticker symbols if only company names are provided (e.g., "Apple" → "AAPL").
- Ensure each insight is detailed, descriptive, fact-based, and sufficient for robust sentiment analysis and forecasting.

# CRITICAL INSTRUCTIONS
- **Output should be in JSON format as specified in the **OUTPUT FORMAT** section without any additional text.**
- Include the article ticker symbol in \`symbols\` only if the insight is directly related to the symbol.
- Clearly list **all ticker symbols** affected by each insight (primary and others mentioned).
- **Do not omit any relevant insights** that can affect stocks, sectors, or the market broadly.

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
    formatInstructions: insightsParser.getFormatInstructions(),
  },
  outputParser: insightsParser,
});
