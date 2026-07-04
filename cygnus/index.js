#!/usr/bin/env node
// @fileoverview cygnus entry point — library for HTML preprocessing.
// Cygnus is designed to be plugged into a Vite project's vite.config.js
// (Vite is a peer dependency, not bundled).

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Warn the user early if Vite is not installed. We check at module load time
// because Vite imports this file (transitively, via vite.config.js) on startup.
try {
    require.resolve('vite');
} catch {
    console.warn(
        '\nCygnus requires Vite to function.\n' +
        '    1. Run: npm install -D vite\n' +
        '    2. See: https://vitejs.dev\n'
    );
}

// Core pipeline helpers (low-level, used internally and by vite.config.js)
export {
    extractCalls,
    extractCssLinks,
    extractName,
    strip
} from './lib/parse.js';

export {
    extractVars,
    stripVars,
    interpolatePrimitives
} from './lib/vars.js';

export { rebuild } from './lib/inject.js';
export { buildErrorOverlay } from './lib/error-overlay.js';

// Vite integration helpers (high-level, used by consumer vite.config.js)
export {
    cygnusPlugin,
    processCygnusHtml,
    copyDirWithHtml,
    safeResolve,
    HAS_DECL_RE
} from './lib/vite-helpers.js';