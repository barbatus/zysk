import { BaseOutputParser } from "@langchain/core/output_parsers";

export class JsonOutputParser<T> extends BaseOutputParser<T> {
  override parse(response: string): Promise<T> {
    const regex = /^(?:```json)?(?<content>.*?)(?:```)?$/s;
    const match = regex.exec(response);
    if (!match) {
      throw new Error("Invalid JSON response");
    }
    return JSON.parse(match.groups?.content ?? "") as Promise<T>;
  }

  override getFormatInstructions(): string {
    return "The output should be a valid JSON object.";
  }

  override lc_namespace: string[] = ["custom"];
}
