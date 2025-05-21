export interface ErrorDetails {
  message: string;
  details?: Record<string, string | number | boolean | object | undefined>;
}

export interface BaseLLMErrorWrapper {
  exit: (error: Error | null) => void;
}

export class LLMError extends Error {
  details?: Record<string, string | number | boolean | object | undefined>;

  constructor({ message, details }: ErrorDetails) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }
}

export class InternalLLMError extends LLMError {}
export class PromptTooLongError extends LLMError {}
export class RateLimitExceededError extends LLMError {
  retryInSeconds?: number;

  constructor({
    message,
    retryInSeconds,
  }: ErrorDetails & { retryInSeconds?: number }) {
    super({ message, details: { retryInSeconds } });
    this.retryInSeconds = retryInSeconds;
  }
}
export class ResponseTimeoutError extends LLMError {}
export class NetworkError extends LLMError {}
export class InvalidPromptError extends LLMError {}
export class ContentFilterError extends LLMError {}

export class FatalTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FatalTimeoutError";
  }
}

export function shouldRetryException(error: Error): boolean {
  return (
    error instanceof ResponseTimeoutError ||
    error instanceof RateLimitExceededError
  );
}
