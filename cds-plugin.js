/**
 * CAP Plugin Entrypoint
 *
 * This file is the auto-discovery entrypoint for CAP plugins.
 * CAP loads any npm package that has a `cds-plugin.js` in its root.
 *
 * Plugin logic is authored in TypeScript at src/cds-plugin.ts.
 * Run `npm run build` to compile to dist/ before publishing or testing.
 */
require('./dist/cds-plugin');
