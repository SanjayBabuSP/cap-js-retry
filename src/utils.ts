/**
 * Utility helpers for cap-js-retry.
 */

/**
 * Calculates the delay for an exponential backoff with optional jitter.
 *
 * Formula: min(maxDelay, baseDelay * 2^attempt) + jitter
 * Jitter is a random value in [0, baseDelay) to spread retries and prevent thundering herd.
 *
 * @param attempt - Zero-based retry attempt index (0 = first retry)
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay cap in milliseconds
 * @param jitter - Whether to add random jitter
 * @returns Delay in milliseconds
 */
export function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  jitter: boolean
): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const cappedDelay = Math.min(maxDelay, exponentialDelay);
  const jitterValue = jitter ? Math.random() * baseDelay : 0;
  return Math.floor(cappedDelay + jitterValue);
}

/**
 * Checks whether an error is retryable based on configuration.
 *
 * @param error - The error thrown by RemoteService.send()
 * @param retryOn - Array of HTTP status codes that should trigger retry
 * @param retryOnTimeout - Whether to retry on timeout errors
 * @returns true if the request should be retried
 */
export function isRetryable(error: any, retryOn: number[], retryOnTimeout: boolean): boolean {
  // Check timeout errors
  if (retryOnTimeout) {
    const code = error?.code ?? '';
    if (
      code === 'ETIMEDOUT' ||
      code === 'ESOCKETTIMEDOUT' ||
      code === 'ECONNRESET' ||
      code === 'ECONNABORTED'
    ) {
      return true;
    }
  }

  // Check HTTP status codes
  const status = error?.status ?? error?.statusCode ?? error?.response?.status;
  if (status && retryOn.includes(status)) {
    return true;
  }

  return false;
}

/**
 * Returns a promise that resolves after the specified delay.
 *
 * @param ms - Delay in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
