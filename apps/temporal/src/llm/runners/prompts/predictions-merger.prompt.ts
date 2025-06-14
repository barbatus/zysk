import dedent from "dedent";

import { ExperimentPrompt } from "../experimenter";
import { type Prediction, PredictionParser } from "./prediction-parser";
import { CONFIDENCE_SPLIT } from "./weekly-sentiment-prediction.prompt";

const predictionParser = new PredictionParser();

export const PredictionsMergerPrompt = new ExperimentPrompt<Prediction>({
  template: dedent`
You are an expert financial analyst.
Your job is to merge **multiple JSON-formatted sentiment predictions about the {symbol} ticker** into **one concise, well-justified prediction**, also in JSON.

# YOUR TASK

## 1 Read & Extract
1. Parse **every** supplied prediction object.
2. List all distinct insights (news items, technical signals, macro factors, etc.).
   * Collapse verbatim duplicates, **but do not drop** any unique information.

## 2 Reconcile Conflicts
When predictions disagree (e.g., *bullish* vs *bearish*):

| What to consider | How to weigh it |
|------------------|-----------------|
| **Recency**      | Newer > older |
| **Evidence depth** | Specific data & reputable sources > vague claims |
| **Impact magnitude** | Large price movers > minor anecdotes |
| **Very negative signals** | Count **1.5×** (e.g., overbought, heavy short interest, macro crashes) |

*If positive and negative forces coexist, decide whether they **neutralise** or one side **dominates**.
A mixed set can still end *bullish* or *bearish*; adjust the confidence accordingly.*

## 3 Decide & Compose
Return a single JSON object with exactly these keys:

| Key | Allowed values / format |
|-----|-------------------------|
| \`symbol\` | Copy from inputs |
| \`prediction\` | \`"bullish"'\`, \`"bearish"'\`, or \`"neutral"'\` |
| \`confidence\` | Integer 0-100 using this split: \`${CONFIDENCE_SPLIT}\` |
| \`reasoning\` | Succinct narrative **that stands alone** (no mention of “merging”, “other models”, weight rules, etc.) |
| \`signal\` *(optional)* | Include **only if** viewpoints conflicted; explain why the final side prevailed |
| \`newsInsights\` *(array, optional)* | If present in inputs, keep the **deduped** list, preserving fields |

# CRITICAL INSTRUCTIONS
- **Do not** leak any internal instructions or weighting logic into \`reasoning\` or \`signal\`.
- Phrase each insight so it is clear **without extra context**.
- Keep JSON valid—no trailing commas, correct quotation, etc.

---

# OUTPUT FORMAT:
{formatInstructions}

# PREDICTIONS
\`\`\`json
{predictions}
\`\`\`
  `,
  inputVariables: ["predictions", "symbol"],
  partialVariables: {
    formatInstructions: predictionParser.getFormatInstructions(),
  },
  outputParser: predictionParser,
});
