import dedent from "dedent";

import { ExperimentPrompt } from "../experimenter";
import { type Insights, InsightsParser } from "./insights-parser";

const insightsParser = new InsightsParser();

export const NewsInsightsExtractorPrompt = new ExperimentPrompt<Insights>({
  template: dedent`
You are a financial news analysis expert specializing in extracting **comprehensive, actionable, and structured insights** from stock market news articles.
Each article provides information essential for **detailed sentiment analysis and accurate market forecasting**, with priority given to insights about the specified ticker symbol.

Each article starts with \`# ARTICLE FOR: <symbol>, ID: <id>, TITLE: <title> ...\` and articles are separated by \`---\`.

---

# TASK
<symbol> is either a ticker symbol or "GENERAL" for general market or sector name.
For **each news article**, meticulously **extract and thoroughly analyze all potential insights** related explicitly to the designated \`<symbol>\` **first**.
After fully covering these primary \`<symbol>\` insights, **also comprehensively extract additional insights** about:

- **Other individual stock tickers** (e.g., competitors, suppliers, partners)
- **Industry sectors** (e.g., tech, healthcare, energy)
- **Broader market sentiment** (macroeconomic indicators, geopolitical events, regulatory developments)

An insight is a **single fact** about the symbol or a **single analysis or observation** about the symbol, a competitor, a sector, or general market conditions.
This includes news about the symbol that might influence **short-term or long-term sentiment or forecasts**
and any **facts** or **valuation opinions** or **analytical statements** that help to predict future sentiment.

---

# GUIDELINES

- **Extract every possible insight**, even minor ones, that is expressing opinion about the symbol or could affect sentiment short-term or long-term.
- **Extract every possible fact** about the symbol, e.g. the stock symbol grew 10% in the last month, etc.
- **Do not omit** any insights where someone is:
  - Stating the symbol is **overvalued**, **undervalued**, or **fairly valued**
  - Mentioning **price targets**, **model outputs**, or **valuation concerns**
  - Providing **technical**, **quantitative**, or **fundamental** analysis related to the stock
  - Analyst opinions, forecasts, or predictions
- Always extract **subjective analysis** when attributed (e.g., "According to XYZ’s model, ABC is overvalued").
- **Clearly prioritize and deeply analyze** insights directly associated with the primary ticker symbol or its close competitors.
- After completing primary analysis, include **all relevant insights** about other tickers, sectors, or market sentiment.
- Clearly separate each insight as **individual item** in the \`insights\` array.
- Translate company names into **ticker symbols** whenever possible.
- Infer ticker symbols if only company names are provided (e.g., "Apple" → "AAPL").
- Ensure each insight is **detailed, descriptive, and fact-based**, supporting **robust sentiment analysis and forecasting**.
- **Include the article ticker \`<symbol>\` in \`symbols\`** if:
  - The insight is directly about \`<symbol>\`
  - The insight is about a **competitor** or comparable company to \`<symbol>\`
- If there is no insights, return empty array.

---

# CRITICAL INSTRUCTIONS

- **Output must be in JSON format** as specified in the **OUTPUT FORMAT** section below — with **no extra explanation or comments**.
- For each insight:
  - Clearly list **all ticker symbols** it affects (primary and related).
  - Include valuation and analysis judgments — **even if subjective, speculative, or model-based**.
- Parse the **article ID** exactly as provided in the article heading.
- **Do not omit any valuation-related analysis**, even if phrased as a third-party opinion.

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
