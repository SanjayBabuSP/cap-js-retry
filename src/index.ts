import { getConfig, getServiceConfig } from './config';
import { calculateDelay, isRetryable, sleep } from './utils';

/**
 * Wraps a RemoteService's `send` method with retry logic.
 *
 * On retryable failures (configured status codes, timeouts), the original send
 * is retried with exponential backoff and optional jitter. Non-retryable errors
 * are thrown immediately.
 *
 * @param cds - The CDS runtime object
 * @param service - The matched CDS RemoteService instance
 */
export function applyPlugin(cds: any, service: any): void {
  const LOG = cds.log('cap-js-retry');
  const globalConfig = getConfig(cds);

  if (!globalConfig.enabled) {
    LOG.info(`Retry plugin disabled, skipping service: ${service.name}`);
    return;
  }

  const config = getServiceConfig(globalConfig, service.name);

  LOG.info(
    `Retry plugin activated for service: ${service.name} (maxRetries=${config.maxRetries}, baseDelay=${config.baseDelay}ms)`
  );

  const originalSend = service.send.bind(service);

  service.send = async function retryableSend(...args: any[]): Promise<any> {
    let lastError: any;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        // First attempt (attempt=0) is the original call, not a retry
        if (attempt > 0) {
          const delay = calculateDelay(
            attempt - 1,
            config.baseDelay,
            config.maxDelay,
            config.jitter
          );
          LOG.warn(
            `Retry ${attempt}/${config.maxRetries} for ${service.name}.send() after ${delay}ms`
          );
          await sleep(delay);
        }

        const result = await originalSend(...args);
        return result;
      } catch (error: any) {
        lastError = error;

        // Don't retry if max retries exhausted
        if (attempt >= config.maxRetries) {
          break;
        }

        // Only retry on retryable errors
        if (!isRetryable(error, config.retryOn, config.retryOnTimeout)) {
          LOG.debug(
            `Non-retryable error for ${service.name}.send(): ${error?.status ?? error?.code ?? 'unknown'}`
          );
          throw error;
        }

        LOG.warn(
          `Retryable error for ${service.name}.send(): ${error?.status ?? error?.code ?? error?.message}`
        );
      }
    }

    LOG.error(`All ${config.maxRetries} retries exhausted for ${service.name}.send()`);
    throw lastError;
  };
}
