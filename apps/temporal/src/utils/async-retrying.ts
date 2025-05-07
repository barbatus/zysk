export interface RetryCallState<T> {
  attemptNumber: number;
  response?: T;
}

export function stopAfterAttempt<T>(maxAttempts: number) {
  return (state: RetryCallState<T>) => state.attemptNumber >= maxAttempts;
}

export function retryIfException(predicate: (error: Error) => boolean) {
  return (error: Error) => predicate(error);
}

export class AsyncRetrying<T> {
  constructor(
    private callback: () => Promise<T>,
    private shouldRetry: (error: Error) => boolean,
    private options: {
      before?: (state: RetryCallState<T>) => Promise<void>;
      stop?: (state: RetryCallState<T>) => boolean;
    },
  ) {}

  async *[Symbol.asyncIterator]() {
    let attempt = 0;
    const retrying = true;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (retrying) {
      attempt++;
      const state: RetryCallState<T> = {
        attemptNumber: attempt,
        response: undefined,
      };
      try {
        await this.options.before?.(state);

        if (this.options.stop?.(state)) {
          break;
        }

        const res = await this.callback();
        state.response = res;
        yield state;

        break;
      } catch (error) {
        if (!this.shouldRetry(error as Error)) {
          throw error;
        }
        yield state;
      }
    }
  }
}
