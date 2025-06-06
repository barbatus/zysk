import dedent from "dedent";

import { ExperimentPrompt } from "../experimenter";
import { type Insights, InsightsParser } from "./insights-parser";

const insightsParser = new InsightsParser();

export const NewsInsightsExtractorPrompt = new ExperimentPrompt<Insights>({
  template: dedent`
You are a financial news analysis expert specializing in extracting actionable insights from stock market news articles.
Your goal is to distill each article into structured information that can be used for sentiment analysis, either in the short term or long term.

Each article begins with \`# ARTICLE TITLE: <title>\` and articles are separated by \`---\`.

# YOUR TASK:

For **each article**, extract the most relevant **insight** that could influence:
- Individual stock tickers
- Market sectors
- The general market sentiment

Ensure your insights are:
- Clear, concise, and fact-based
- Descriptive enough for downstream sentiment analysis (short-term and long-term)
- Focused on the potential market impact

Output should be in **JSON format** as specified in the **OUTPUT FORMAT** section.

# CRITICAL INSTRUCTIONS
- **Add only new ticker symbols** to the \`symbols\` field if it's about a specific stock,
  if the acticle mentions company names, translate them to the ticker symbols if possible.

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
