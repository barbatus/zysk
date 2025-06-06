import dedent from "dedent";

import { ExperimentPrompt } from "../experimenter";
import { type Prediction, PredictionParser } from "./prediction-parser";
import { CONFIDENCE_SPLIT } from "./sentiment-prediction.prompt";

const predictionParser = new PredictionParser();

export const PredictionsMergerPrompt = new ExperimentPrompt<Prediction>({
  template: dedent`
You are an expert financial analyst whose goal is to merge multiple {symbol} ticker sentiment predictions in JSON format into a single coherent and justified sentiment prediction in JSON format.

# YOUR TASK
1. Carefully review all the given predictions.
2. Eliminate duplicate insights and consolidate overlapping reasoning but make sure that **all unique insights are not lost and are present in the output**.
3. If sentiments are **contradictory** (e.g., one says "bullish", another says "bearish"), analyze the **underlying signals and reasoning** in each prediction:
   - Determine **which insights are stronger**, better supported, or more recent.
   - Weigh **very negative insights** more heavily (1.5x weight).
   - Consider whether conflicting signals can **neutralize** each other or if one outweighs the other.
   - If positive and negative sentiments are both valid, the final output may still lean negative or positive, but with an adjusted confidence score and explanation.
4. Make a final decision on:
   - **Prediction**: one of \`bullish\`, \`bearish\`, or \`neutral\`.
   - **Confidence**: integer from 0–100, with the following split:
      ${CONFIDENCE_SPLIT}
   - If there’s contradiction, provide a \`signal\` field explaining why the final decision leans one way despite opposing evidence.
5. Do not mention that predictions converge, anything about that you are merging predictions in the \`reasoning\` field.
   It should be entirely focused on the reasoning for the final prediction.
6. The final prediction should be in the same JSON format as the predictions provided.
7. When merging merging make your best judgement taking into account to the following:
   1. **Watch out** for all signals that could negatively affect short term {symbol} ticker price in short term such as:
      - market downturn sentiment in GENERAL MARKET SENTIMENT section
      - **very negative** news about {symbol} in NEWS ARTICLES section
      - big short interest in {symbol} in NEWS ARTICLES section
      - signs that stock is overbought in NEWS ARTICLES section
      - etc
   2.  **Watch out** for all signals that could positively affect short term ticker price:
      - since the goal is to predict ticker sentiment certain signals might have stronger effect over fundamental factors
      - for example, if some high profile person joins the company it might have a positive impact on the stock price in the short term stronger that negative news of tariff being raised
   3. Additionaly, pay attention to short term rules the market sometimes follows such as:
         - some of the negative signals might outweigh easily strongest positive signals, for example, such as "if there is a signal that stock is overbought" etc
         - if market is bullish then any positive signal about {symbol} might outweigh negative signals and vice versa
         - etc

# CRITICAL INSTRUCTIONS
  - Do not mention any specific instructions of the prompt (e.g. negative news have certain weight, etc) in the \`reasoning\` field.

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
