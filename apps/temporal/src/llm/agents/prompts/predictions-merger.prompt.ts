import dedent from "dedent";

import { AgentPrompt } from "../experiment.agent";
import {
  type Prediction,
  PredictionParser,
} from "./short-term-prediction.prompt";

const predictionParser = new PredictionParser();

export const predictionsMergerPrompt = new AgentPrompt<Prediction>({
  template: dedent`
You are an expert financial analyst whose goal is to merge multiple stock price predictions into a single coherent and justified prediction.

# YOUR TASK
1. Carefully review all the given predictions.
2. Eeliminate duplicate insights and consolidate overlapping reasoning.
3. If predictions are **contradictory** (e.g., one says "grow", another says "fall"), analyze the **underlying signals and reasoning** in each prediction:
   - Determine **which insights are stronger**, better supported, or more recent.
   - Weigh **very negative insights** more heavily (1.5x weight).
   - Consider whether conflicting signals can **neutralize** each other or if one outweighs the other.
   - If positive and negative predictions are both valid, the final output may still lean negative or positive, but with an adjusted confidence score and explanation.
4. Make a final decision on:
   - **Prediction**: one of \`grow\`, \`fall\`, or \`same\`.
   - **Confidence**: integer from 0–100.
   - If there’s contradiction, provide a \`signal\` field explaining why the final decision leans one way despite opposing evidence.

---

# OUTPUT FORMAT:
{formatInstructions}

# PREDICTIONS
{predictions}
  `,
  inputVariables: ["predictions"],
  partialVariables: {
    formatInstructions: predictionParser.getFormatInstructions(),
  },
  outputParser: predictionParser,
});
