import { BaseOutputParser } from "@langchain/core/output_parsers";
import { jsonrepair } from "jsonrepair";

export class ParserError extends Error {}

export class JsonOutputParser<T> extends BaseOutputParser<T> {
  override async parse(response: string): Promise<T> {
    const regex = /^(?:```json)?(?<content>.*?)(?:```)?$/s;
    const match = regex.exec(response.trim());
    if (!match) {
      throw new ParserError("Invalid JSON response");
    }
    const jsonStr = jsonrepair(match.groups?.content ?? "{}");
    return JSON.parse(jsonStr) as Promise<T>;
  }

  override getFormatInstructions(): string {
    return "The output should be a valid JSON object.";
  }

  override lc_namespace: string[] = ["custom"];
}
