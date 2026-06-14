#!/usr/bin/env node
// @fileoverview cygnus entry point

export { extractCalls, extractCssLinks, extractName, strip } from './lib/parse.js';
export { extractVars, stripVars, interpolatePrimitives } from './lib/vars.js';
export { rebuild } from './lib/inject.js';
export { buildErrorOverlay } from './lib/error-overlay.js';