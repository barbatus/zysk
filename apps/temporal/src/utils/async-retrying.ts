export interface RetryCallState {
  attemptNumber: number;
}

export function stopAfterAttempt(maxAttempts: number) {
  return (state: RetryCallState) => state.attemptNumber >= maxAttempts;
}

export function retryIfException(predicate: (error: Error) => boolean) {
  return (error: Error) => predicate(error);
}

export class AsyncRetrying {
  constructor(
    private stop: (state: RetryCallState) => boolean,
    private retry: (error: Error) => boolean,
    private options: { before?: (state: RetryCallState) => Promise<void> },
  ) {}

  async *[Symbol.asyncIterator]() {
    let attempt = 0;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      attempt++;
      const state: RetryCallState = { attemptNumber: attempt };

      if (this.options.before) {
        await this.options.before(state);
      }

      if (this.stop(state)) {
        break;
      }

      yield state;
    }
  }
}
