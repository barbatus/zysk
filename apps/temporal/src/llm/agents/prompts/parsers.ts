import { BaseOutputParser } from "@langchain/core/output_parsers";

export class ParserError extends Error {}

export class JsonOutputParser<T> extends BaseOutputParser<T> {
  override async parse(response: string): Promise<T> {
    const regex = /^(?:```json)?(?<content>.*?)(?:```)?$/s;
    const match = regex.exec(response);
    if (!match) {
      throw new ParserError("Invalid JSON response");
    }
    return JSON.parse(match.groups?.content ?? "") as Promise<T>;
  }

  override getFormatInstructions(): string {
    return "The output should be a valid JSON object.";
  }

  override lc_namespace: string[] = ["custom"];
}
