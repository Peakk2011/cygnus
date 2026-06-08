#!/usr/bin/env node
// @fileoverview cygnus entry point

import { serve, processHtml } from './lib/serve.js';
import { extractCalls, strip } from './lib/parse.js';
import { rebuild } from './lib/inject.js';

// CLI
const [,, dir = '.', port = '3000'] = process.argv;
serve(dir, parseInt(port));

export {
    serve,
    processHtml,
    extractCalls,
    strip,
    rebuild
};