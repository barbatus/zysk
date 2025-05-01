import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export interface TrimResult {
  wasTrimmed: boolean;
  originalTokens: number;
  estimatedTokens: number;
  originalLength: number;
  newLength: number;
  truncationPoint: number;
  trimmedText: string;
}

export class PromptTrimmer {
  constructor(
    private maxContextWindow: number,
    private charsPerToken = 3.5,
    private safetyMargin = 100,
  ) {}

  private estimateTokens(text: string): number {
    const specialChars = (text.match(/\w+/g) ?? []).length;
    const baseChars = text.length;
    const weightedLength = baseChars + specialChars * 0.5;
    return Math.ceil(weightedLength / this.charsPerToken);
  }

  private shouldTrim(text: string) {
    const estimatedTokens = this.estimateTokens(text);
    const maxAllowed = this.maxContextWindow - this.safetyMargin;
    return estimatedTokens > maxAllowed;
  }

  async trim(text: string): Promise<TrimResult> {
    const originalLength = text.length;
    const originalTokens = this.estimateTokens(text);
    const maxAllowedTokens = this.maxContextWindow - this.safetyMargin;

    if (!this.shouldTrim(text)) {
      return {
        wasTrimmed: false,
        originalTokens,
        estimatedTokens: originalTokens,
        originalLength,
        newLength: originalLength,
        truncationPoint: originalLength,
        trimmedText: text,
      };
    }

    const trimmer = new RecursiveCharacterTextSplitter({
      chunkSize: maxAllowedTokens * this.charsPerToken,
      chunkOverlap: 0,
      separators: [".", "!", "?"],
    });

    const chunks = await trimmer.splitText(text);
    const trimmedText = chunks[0]; // Take the first chunk as it's already token-limited

    return {
      wasTrimmed: true,
      originalTokens,
      estimatedTokens: this.estimateTokens(trimmedText),
      originalLength,
      newLength: trimmedText.length,
      truncationPoint: trimmedText.length,
      trimmedText,
    };
  }
}
