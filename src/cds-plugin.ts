/**
 * CAP Plugin Entrypoint (TypeScript source)
 *
 * Compiled to dist/cds-plugin.js, which is referenced by the root cds-plugin.js.
 * CAP auto-discovers the plugin via the root cds-plugin.js entrypoint.
 *
 * This plugin wraps RemoteService.send() with exponential backoff retry logic.
 * Run `npm run build` before publishing or testing.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const cds = require('@sap/cds');
import { applyPlugin } from './index';

const LOG = cds.log('cap-js-retry');

// Hook into 'connect' lifecycle to wrap RemoteService instances.
// RemoteService calls are the primary use case for retry logic
// (e.g., S/4HANA, external APIs via SAP BTP Destination Service).
cds.on('connect', (service: any) => {
  if (service instanceof cds.RemoteService) {
    LOG.info(`Applying retry plugin to RemoteService: ${service.name}`);
    applyPlugin(cds, service);
  }
});
