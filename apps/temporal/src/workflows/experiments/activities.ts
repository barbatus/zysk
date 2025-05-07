import { MarketPredictorAgent } from "#/llm/agents/market-predictor.agent";

export async function runPredictionExperiment() {
  const agent = await MarketPredictorAgent.create();
  return await agent.run();
}
