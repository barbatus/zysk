import dedent from "dedent";

import { AgentPrompt } from "../experiment.agent";
import { type Prediction, PredictionParser } from "./prediction-parser";
import { CONFIDENCE_SPLIT } from "./sentiment-prediction.prompt";

const predictionParser = new PredictionParser();

export const PredictionsMergerPrompt = new AgentPrompt<Prediction>({
  template: dedent`
You are an expert financial analyst whose goal is to merge multiple {symbol} ticker sentiment predictions in JSON format into a single coherent and justified sentiment prediction in JSON format.

# YOUR TASK
1. Carefully review all the given predictions.
2. Eliminate duplicate insights and consolidate overlapping reasoning.
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
