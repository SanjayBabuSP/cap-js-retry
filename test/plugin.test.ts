import { getConfig, getServiceConfig, DEFAULTS } from '../src/config';
import type { RetryConfig } from '../src/config';
import { calculateDelay, isRetryable, sleep } from '../src/utils';
import { applyPlugin } from '../src/index';

// ─── Unit Tests: config ──────────────────────────────────────────

describe('getConfig', () => {
  it('returns defaults when no user config is set', () => {
    const mockCds = { env: {} };
    const config = getConfig(mockCds);
    expect(config).toEqual(DEFAULTS);
  });

  it('merges user config with defaults', () => {
    const mockCds = {
      env: {
        retry: { maxRetries: 5, baseDelay: 500 },
      },
    };
    const config = getConfig(mockCds);
    expect(config.maxRetries).toBe(5);
    expect(config.baseDelay).toBe(500);
    expect(config.enabled).toBe(true); // default preserved
    expect(config.retryOn).toEqual(DEFAULTS.retryOn); // default preserved
  });

  it('disables plugin when enabled is false', () => {
    const mockCds = {
      env: { retry: { enabled: false } },
    };
    const config = getConfig(mockCds);
    expect(config.enabled).toBe(false);
  });

  it('uses defaults when cds.env.retry is undefined', () => {
    const mockCds = { env: { retry: undefined } };
    const config = getConfig(mockCds);
    expect(config).toEqual(DEFAULTS);
  });

  it('accepts custom retryOn status codes', () => {
    const mockCds = {
      env: { retry: { retryOn: [429, 503] } },
    };
    const config = getConfig(mockCds);
    expect(config.retryOn).toEqual([429, 503]);
  });

  it('merges per-service overrides', () => {
    const mockCds = {
      env: {
        retry: {
          services: {
            API_BUSINESS_PARTNER: { maxRetries: 5, baseDelay: 1000 },
          },
        },
      },
    };
    const config = getConfig(mockCds);
    expect(config.services.API_BUSINESS_PARTNER).toEqual({
      maxRetries: 5,
      baseDelay: 1000,
    });
  });
});

// ─── Unit Tests: getServiceConfig ────────────────────────────────

describe('getServiceConfig', () => {
  const baseConfig: RetryConfig = {
    ...DEFAULTS,
    services: {
      S4Service: { maxRetries: 5, baseDelay: 1000 },
    },
  };

  it('returns global config when no service override exists', () => {
    const result = getServiceConfig(baseConfig, 'UnknownService');
    expect(result.maxRetries).toBe(DEFAULTS.maxRetries);
    expect(result.baseDelay).toBe(DEFAULTS.baseDelay);
  });

  it('merges service-specific overrides', () => {
    const result = getServiceConfig(baseConfig, 'S4Service');
    expect(result.maxRetries).toBe(5);
    expect(result.baseDelay).toBe(1000);
    expect(result.jitter).toBe(DEFAULTS.jitter); // non-overridden default
  });

  it('service override for retryOn replaces global', () => {
    const config: RetryConfig = {
      ...DEFAULTS,
      services: {
        MyAPI: { retryOn: [429] },
      },
    };
    const result = getServiceConfig(config, 'MyAPI');
    expect(result.retryOn).toEqual([429]);
  });
});

// ─── Unit Tests: calculateDelay ──────────────────────────────────

describe('calculateDelay', () => {
  it('computes exponential delay without jitter', () => {
    expect(calculateDelay(0, 200, 5000, false)).toBe(200); // 200 * 2^0
    expect(calculateDelay(1, 200, 5000, false)).toBe(400); // 200 * 2^1
    expect(calculateDelay(2, 200, 5000, false)).toBe(800); // 200 * 2^2
    expect(calculateDelay(3, 200, 5000, false)).toBe(1600); // 200 * 2^3
  });

  it('caps at maxDelay', () => {
    expect(calculateDelay(10, 200, 5000, false)).toBe(5000);
  });

  it('adds jitter when enabled', () => {
    const delays = new Set<number>();
    for (let i = 0; i < 20; i++) {
      delays.add(calculateDelay(0, 200, 5000, true));
    }
    // With jitter, delay should be in [200, 400) — check at least some variation
    for (const d of delays) {
      expect(d).toBeGreaterThanOrEqual(200);
      expect(d).toBeLessThan(400);
    }
    // Statistically very unlikely to get the same value 20 times with jitter
    expect(delays.size).toBeGreaterThan(1);
  });
});

// ─── Unit Tests: isRetryable ─────────────────────────────────────

describe('isRetryable', () => {
  const defaultRetryOn = DEFAULTS.retryOn;

  it('returns true for retryable status codes', () => {
    expect(isRetryable({ status: 503 }, defaultRetryOn, true)).toBe(true);
    expect(isRetryable({ status: 429 }, defaultRetryOn, true)).toBe(true);
    expect(isRetryable({ status: 500 }, defaultRetryOn, true)).toBe(true);
    expect(isRetryable({ status: 502 }, defaultRetryOn, true)).toBe(true);
    expect(isRetryable({ status: 504 }, defaultRetryOn, true)).toBe(true);
    expect(isRetryable({ status: 408 }, defaultRetryOn, true)).toBe(true);
  });

  it('returns false for non-retryable status codes', () => {
    expect(isRetryable({ status: 400 }, defaultRetryOn, true)).toBe(false);
    expect(isRetryable({ status: 401 }, defaultRetryOn, true)).toBe(false);
    expect(isRetryable({ status: 403 }, defaultRetryOn, true)).toBe(false);
    expect(isRetryable({ status: 404 }, defaultRetryOn, true)).toBe(false);
    expect(isRetryable({ status: 422 }, defaultRetryOn, true)).toBe(false);
  });

  it('returns true for timeout errors', () => {
    expect(isRetryable({ code: 'ETIMEDOUT' }, defaultRetryOn, true)).toBe(true);
    expect(isRetryable({ code: 'ESOCKETTIMEDOUT' }, defaultRetryOn, true)).toBe(true);
    expect(isRetryable({ code: 'ECONNRESET' }, defaultRetryOn, true)).toBe(true);
    expect(isRetryable({ code: 'ECONNABORTED' }, defaultRetryOn, true)).toBe(true);
  });

  it('returns false for timeout errors when retryOnTimeout is disabled', () => {
    expect(isRetryable({ code: 'ETIMEDOUT' }, defaultRetryOn, false)).toBe(false);
    expect(isRetryable({ code: 'ECONNRESET' }, defaultRetryOn, false)).toBe(false);
  });

  it('handles statusCode property (axios-style errors)', () => {
    expect(isRetryable({ statusCode: 503 }, defaultRetryOn, true)).toBe(true);
  });

  it('handles response.status (nested errors)', () => {
    expect(isRetryable({ response: { status: 503 } }, defaultRetryOn, true)).toBe(true);
  });

  it('returns false for unknown errors', () => {
    expect(isRetryable({}, defaultRetryOn, true)).toBe(false);
    expect(isRetryable({ message: 'Something went wrong' }, defaultRetryOn, true)).toBe(false);
  });
});

// ─── Unit Tests: sleep ───────────────────────────────────────────

describe('sleep', () => {
  it('resolves after approximately the specified delay', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40); // allow some timer imprecision
    expect(elapsed).toBeLessThan(200);
  });
});

// ─── Unit Tests: applyPlugin ─────────────────────────────────────

describe('applyPlugin', () => {
  const createMockCds = (retryConfig: Partial<RetryConfig> = {}) => ({
    env: { retry: retryConfig },
    log: () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
  });

  const createMockService = (
    name = 'TestRemoteService',
    sendFn: jest.Mock = jest.fn().mockResolvedValue({ id: 1 })
  ) => ({
    name,
    send: sendFn,
    before: jest.fn(),
    on: jest.fn(),
    after: jest.fn(),
  });

  it('activates plugin and wraps send method', () => {
    const cds = createMockCds();
    const originalSend = jest.fn().mockResolvedValue({ ok: true });
    const service = createMockService('S4Service', originalSend);

    applyPlugin(cds, service);

    // send should be replaced
    expect(service.send).not.toBe(originalSend);
  });

  it('skips wrapping when disabled', () => {
    const cds = createMockCds({ enabled: false });
    const originalSend = jest.fn();
    const service = createMockService('S4Service', originalSend);

    applyPlugin(cds, service);

    // send should not be replaced
    expect(service.send).toBe(originalSend);
  });

  it('calls original send on success (no retry)', async () => {
    const cds = createMockCds();
    const originalSend = jest.fn().mockResolvedValue({ id: 42 });
    const service = createMockService('S4Service', originalSend);

    applyPlugin(cds, service);

    const result = await service.send('READ', 'Items');
    expect(result).toEqual({ id: 42 });
    expect(originalSend).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable errors and succeeds', async () => {
    const cds = createMockCds({ baseDelay: 10, maxDelay: 50, jitter: false });
    const originalSend = jest
      .fn()
      .mockRejectedValueOnce({ status: 503, message: 'Service Unavailable' })
      .mockRejectedValueOnce({ status: 503, message: 'Service Unavailable' })
      .mockResolvedValue({ id: 1 });

    const service = createMockService('S4Service', originalSend);

    applyPlugin(cds, service);

    const result = await service.send('READ', 'Items');
    expect(result).toEqual({ id: 1 });
    expect(originalSend).toHaveBeenCalledTimes(3); // 1 original + 2 retries
  });

  it('throws immediately on non-retryable errors', async () => {
    const cds = createMockCds({ baseDelay: 10 });
    const originalSend = jest.fn().mockRejectedValue({ status: 400, message: 'Bad Request' });
    const service = createMockService('S4Service', originalSend);

    applyPlugin(cds, service);

    await expect(service.send('CREATE', 'Items', { name: 'test' })).rejects.toEqual({
      status: 400,
      message: 'Bad Request',
    });
    expect(originalSend).toHaveBeenCalledTimes(1); // no retry
  });

  it('exhausts all retries and throws last error', async () => {
    const cds = createMockCds({ maxRetries: 2, baseDelay: 10, jitter: false });
    const originalSend = jest.fn().mockRejectedValue({ status: 503, message: 'Down' });
    const service = createMockService('S4Service', originalSend);

    applyPlugin(cds, service);

    await expect(service.send('READ', 'Items')).rejects.toEqual({
      status: 503,
      message: 'Down',
    });
    expect(originalSend).toHaveBeenCalledTimes(3); // 1 original + 2 retries
  });

  it('retries on timeout errors', async () => {
    const cds = createMockCds({ baseDelay: 10, jitter: false });
    const originalSend = jest
      .fn()
      .mockRejectedValueOnce({ code: 'ETIMEDOUT', message: 'Timeout' })
      .mockResolvedValue({ id: 1 });

    const service = createMockService('S4Service', originalSend);

    applyPlugin(cds, service);

    const result = await service.send('READ', 'Items');
    expect(result).toEqual({ id: 1 });
    expect(originalSend).toHaveBeenCalledTimes(2);
  });

  it('uses per-service config overrides', async () => {
    const cds = createMockCds({
      maxRetries: 1,
      baseDelay: 10,
      jitter: false,
      services: {
        HighRetryService: { maxRetries: 4 },
      },
    });

    const originalSend = jest
      .fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockRejectedValueOnce({ status: 503 })
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValue({ id: 1 });

    const service = createMockService('HighRetryService', originalSend);

    applyPlugin(cds, service);

    const result = await service.send('READ', 'Items');
    expect(result).toEqual({ id: 1 });
    expect(originalSend).toHaveBeenCalledTimes(4); // 1 original + 3 retries (maxRetries=4 allows it)
  });

  it('forwards all arguments to original send', async () => {
    const cds = createMockCds();
    const originalSend = jest.fn().mockResolvedValue({ ok: true });
    const service = createMockService('S4Service', originalSend);

    applyPlugin(cds, service);

    await service.send('CREATE', 'Items', { name: 'Test', status: 'active' });
    expect(originalSend).toHaveBeenCalledWith('CREATE', 'Items', {
      name: 'Test',
      status: 'active',
    });
  });
});
