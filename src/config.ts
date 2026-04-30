/**
 * Configuration for cap-js-retry plugin.
 *
 * Users configure the plugin via cds.env (package.json or .cdsrc.json):
 * ```json
 * {
 *   "cds": {
 *     "retry": {
 *       "enabled": true,
 *       "maxRetries": 3,
 *       "baseDelay": 200,
 *       "maxDelay": 5000,
 *       "jitter": true,
 *       "retryOn": [408, 429, 500, 502, 503, 504],
 *       "retryOnTimeout": true,
 *       "services": {
 *         "API_BUSINESS_PARTNER": { "maxRetries": 5, "baseDelay": 500 }
 *       }
 *     }
 *   }
 * }
 * ```
 */

export interface RetryConfig {
  /** Enable or disable the retry plugin globally. Default: true */
  enabled: boolean;
  /** Maximum number of retry attempts. Default: 3 */
  maxRetries: number;
  /** Base delay in milliseconds for exponential backoff. Default: 200 */
  baseDelay: number;
  /** Maximum delay cap in milliseconds. Default: 5000 */
  maxDelay: number;
  /** Add random jitter to delay to prevent thundering herd. Default: true */
  jitter: boolean;
  /** HTTP status codes that trigger a retry. Default: [408, 429, 500, 502, 503, 504] */
  retryOn: number[];
  /** Retry on timeout errors (ETIMEDOUT, ESOCKETTIMEDOUT). Default: true */
  retryOnTimeout: boolean;
  /** Per-service overrides keyed by service name. */
  services: Record<string, Partial<Omit<RetryConfig, 'enabled' | 'services'>>>;
}

export const DEFAULTS: RetryConfig = {
  enabled: true,
  maxRetries: 3,
  baseDelay: 200,
  maxDelay: 5000,
  jitter: true,
  retryOn: [408, 429, 500, 502, 503, 504],
  retryOnTimeout: true,
  services: {},
};

/**
 * Reads retry configuration from cds.env and merges with defaults.
 *
 * @param cds - The CDS runtime object
 * @returns Merged configuration
 */
export function getConfig(cds: any): RetryConfig {
  const userConfig = cds.env?.retry ?? {};
  return {
    ...DEFAULTS,
    ...userConfig,
    retryOn: userConfig.retryOn ?? DEFAULTS.retryOn,
    services: { ...DEFAULTS.services, ...userConfig.services },
  };
}

/**
 * Resolves the effective retry config for a specific service,
 * merging global defaults with per-service overrides.
 *
 * @param config - Global retry config
 * @param serviceName - Name of the CDS service
 * @returns Effective config for the service
 */
export function getServiceConfig(
  config: RetryConfig,
  serviceName: string
): Omit<RetryConfig, 'enabled' | 'services'> {
  const base = {
    maxRetries: config.maxRetries,
    baseDelay: config.baseDelay,
    maxDelay: config.maxDelay,
    jitter: config.jitter,
    retryOn: config.retryOn,
    retryOnTimeout: config.retryOnTimeout,
  };

  const override = config.services[serviceName];
  if (!override) {
    return base;
  }

  return {
    ...base,
    ...override,
    retryOn: override.retryOn ?? base.retryOn,
  };
}
