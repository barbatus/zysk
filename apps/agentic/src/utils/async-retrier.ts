export interface RetryCallState<T> {
  attemptNumber: number;
  response?: T;
  success?: boolean;
  lastError?: Error;
}

export function stopAfterAttempt<T>(maxAttempts: number) {
  return (state: RetryCallState<T>) => state.attemptNumber > maxAttempts;
}

export function retryIfException(predicate: (error: Error) => boolean) {
  return (error: Error) => predicate(error);
}

export class AsyncRetrier<T> {
  constructor(
    private callback: (attempt: number) => Promise<T>,
    private shouldRetry: (error: Error) => boolean,
    private options: {
      before?: (state: RetryCallState<T>) => Promise<void>;
      stop?: (state: RetryCallState<T>) => boolean;
    },
  ) {}

  async try() {
    let attempt = 0;
    const state: RetryCallState<T> = {
      attemptNumber: attempt,
      response: undefined,
    };
    while (true) {
      attempt++;
      state.attemptNumber = attempt;
      await this.options.before?.(state);

      if (this.options.stop?.(state)) {
        throw new Error("AsyncRetrying exceeded max attempts");
      }
      try {
        const res = await this.callback(attempt);
        state.success = true;
        state.response = res;
        return res;
      } catch (error) {
        if (!this.shouldRetry(error as Error)) {
          throw error;
        }
        state.success = false;
        state.lastError = error as Error;
      }
    }
  }
}
