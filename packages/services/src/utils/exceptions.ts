export class RateLimitExceededError extends Error {
  public readonly retryInSec: number;

  constructor(message: string, retryInSec: number) {
    super(message);
    this.retryInSec = retryInSec;
  }
}

export class RequestTimeoutError extends Error {}
