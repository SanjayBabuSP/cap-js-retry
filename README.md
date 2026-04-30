# cap-js-retry

> Automatic retry with exponential backoff for SAP CAP RemoteService calls

A [CAP](https://cap.cloud.sap/) plugin that wraps `RemoteService.send()` with configurable retry logic — exponential backoff, jitter, per-service overrides, and status-code-based retry conditions. Zero-config by default.

## Why

Every CAP app integrating with S/4HANA or external APIs needs retry logic. Network blips, 503s, and rate limits (429) are a fact of life. Without this plugin, developers write retry boilerplate manually in every project.

## Features

- **Exponential backoff with jitter** — prevents thundering herd
- **Per-service configuration** — different retry policies for different APIs
- **Configurable retry conditions** — status codes (408, 429, 500, 502, 503, 504) and timeout errors
- **Zero-config auto-wrapping** — automatically wraps all `RemoteService` instances
- **CDS 9+ / Node 20+** compatible

## Installation

```bash
npm install cap-js-retry
```

The plugin auto-activates via CAP's `cds-plugin.js` convention. No code changes needed.

## Configuration

Configure via `package.json` or `.cdsrc.json`:

```json
{
  "cds": {
    "retry": {
      "enabled": true,
      "maxRetries": 3,
      "baseDelay": 200,
      "maxDelay": 5000,
      "jitter": true,
      "retryOn": [408, 429, 500, 502, 503, 504],
      "retryOnTimeout": true
    }
  }
}
```

### Per-Service Overrides

```json
{
  "cds": {
    "retry": {
      "maxRetries": 3,
      "services": {
        "API_BUSINESS_PARTNER": {
          "maxRetries": 5,
          "baseDelay": 500
        },
        "API_SALES_ORDER": {
          "maxRetries": 2,
          "retryOn": [429, 503]
        }
      }
    }
  }
}
```

### Options

| Option           | Type       | Default                     | Description                                   |
| ---------------- | ---------- | --------------------------- | --------------------------------------------- |
| `enabled`        | `boolean`  | `true`                      | Enable/disable plugin globally                |
| `maxRetries`     | `number`   | `3`                         | Maximum retry attempts                        |
| `baseDelay`      | `number`   | `200`                       | Base delay in ms for backoff                  |
| `maxDelay`       | `number`   | `5000`                      | Maximum delay cap in ms                       |
| `jitter`         | `boolean`  | `true`                      | Add random jitter to delay                    |
| `retryOn`        | `number[]` | `[408,429,500,502,503,504]` | HTTP status codes to retry                    |
| `retryOnTimeout` | `boolean`  | `true`                      | Retry on ETIMEDOUT, ECONNRESET, etc.          |
| `services`       | `object`   | `{}`                        | Per-service overrides (keyed by service name) |

## How It Works

1. Plugin hooks into `cds.on('connect')` lifecycle
2. Detects `RemoteService` instances (S/4HANA, external APIs)
3. Wraps `service.send()` with retry logic
4. On failure: checks if error is retryable → waits with exponential backoff → retries
5. On success or non-retryable error: returns/throws immediately

### Backoff Formula

```
delay = min(maxDelay, baseDelay × 2^attempt) + random(0, baseDelay)
```

Example with defaults (baseDelay=200ms):

- Retry 1: ~200–400ms
- Retry 2: ~400–600ms
- Retry 3: ~800–1000ms

## Development

```bash
npm install
npm run build
npm test
npm run test:dry-run   # Build + npm pack --dry-run
```

## Scripts

| Script                 | Description                   |
| ---------------------- | ----------------------------- |
| `npm run build`        | Compile TypeScript to `dist/` |
| `npm run build:watch`  | Watch mode compilation        |
| `npm test`             | Run Jest tests                |
| `npm run test:unit`    | Unit tests only               |
| `npm run test:dry-run` | Build + `npm pack --dry-run`  |
| `npm run lint`         | Run ESLint                    |
| `npm run format`       | Format with Prettier          |

## Publishing

```bash
# Build and verify package contents
npm run test:dry-run

# Publish to npm
npm run build
npm publish
```

Automated publishing via GitHub Actions is configured with semantic-release. See `.github/workflows/release.yml`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[Apache-2.0](LICENSE)
