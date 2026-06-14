#!/usr/bin/env node
// @fileoverview cygnus entry point

import { serve, processHtml } from './lib/serve.js';
import { extractCalls, extractCssLinks, extractName, strip } from './lib/parse.js';
import { extractVars, stripVars, interpolatePrimitives } from './lib/vars.js';
import { rebuild } from './lib/inject.js';
import { buildErrorOverlay } from './lib/error-overlay.js';

// CLI
const [,, dir = '.', port = '3000'] = process.argv;
serve(dir, parseInt(port));

export {
    serve,
    processHtml,
    extractCalls,
    extractCssLinks,
    extractName,
    strip,
    extractVars,
    stripVars,
    interpolatePrimitives,
    rebuild,
    buildErrorOverlay
};