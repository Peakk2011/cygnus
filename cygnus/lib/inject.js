// @fileoverview rebuild complete HTML - inject DOCTYPE, <html>, <head>, and using() script

import fs from 'fs';
import path from 'path';
import { interpolatePrimitives, extractVars, stripVars } from './vars.js';

/**
 * Minimal toggle() function injected at build time.
 */
const TOGGLE_FN = `
const toggle = (id, cls = 'active') => {
    const el = document.getElementById(id) || document.querySelector('.' + id);

    if (el) el.classList.toggle(cls);
};
`;

/**
 * Extract *varName.create(...) content from a raw file string at build time.
 *
 * @param {string} raw - Raw file content
 * @param {string} varName - Variable name (without *)
 * @param {string} filePath - File path for error messages
 * @returns {string} Extracted HTML content
 */
const extractVarFromFile = (raw, varName, filePath) => {
    const re = new RegExp(`\\*${varName}\\.create\\(`);
    const match = raw.match(re);

    if (!match) {
        throw new Error(`cygnus build: *${varName}.create(...) not found in "${filePath}"`);
    }

    const openIdx = match.index + match[0].length - 1;
    let depth = 0;
    let i = openIdx;

    for (; i < raw.length; i++) {
        if (raw[i] === '(') depth++;
        if (raw[i] === ')') {
            depth--;
            if (depth === 0) break;
        }
    }

    if (depth !== 0) {
        throw new Error(`cygnus build: unclosed *${varName}.create(...) in "${filePath}"`);
    }

    return raw.slice(openIdx + 1, i).trim();
};

/**
 * Build inline script for DEV mode — runtime fetch via using().
 *
 * @param {Array<Object>} calls - Array of using() call objects
 * @param {string} getHtmlSrc - Source code of getHTML utility (inlined directly)
 * @param {Map<string, {value: any, type: string}>} vars - Map of variable names to content
 * @returns {string} Inline script as HTML string
 */
const buildScriptDev = (calls, getHtmlSrc = '', vars = new Map()) => {
    if (!calls.length) return '';

    const lines = calls.map((call) => {
        // Case 1: Normal file load
        if (call.src !== undefined) {
            return `    await using('${call.sel}', '${call.src}');`;
        }

        // Case 2: Variable from current file
        if (!call.file) {
            const entry = vars.get(call.varName);

            if (entry === undefined) {
                throw new Error(`cygnus: *${call.varName} is not defined in this file`);
            }

            const html = typeof entry === 'object' ? entry.value : entry;
            const escaped = html
                .replace(/`/g, '\\`')
                .replace(/\$\{/g, '\\${');

            return `    document.querySelector('${call.sel}').innerHTML = \`${escaped}\`;`;
        }

        // Case 3: Variable from another file
        return `    await using('${call.sel}', '${call.file}', { varName: '${call.varName}' });`;
    }).join('\n');

    return `  <script type="module">
${getHtmlSrc}
    document.addEventListener('DOMContentLoaded', async () => {
${lines}
    });
  </script>`;
};

/**
 * Build inline script for BUILD mode — all @using resolved at compile time.
 *
 * @param {Array<Object>} calls - Array of using() call objects
 * @param {Map<string, {value: any, type: string}>} vars - Variable map
 * @param {string} fileDir - Directory of the HTML file being compiled
 * @param {boolean} needsToggle - Whether toggle() is referenced in content
 * @returns {string} Inline script tag or empty string
 */
const buildScriptBuild = (calls, vars, fileDir, needsToggle) => {
    if (!calls.length && !needsToggle) return '';

    const lines = calls.map((call) => {
        // Case 1: Normal file load → read and inline at compile time
        if (call.src !== undefined) {
            const absPath = path.resolve(fileDir, call.src);

            if (!fs.existsSync(absPath)) {
                throw new Error(`cygnus build: file not found "${call.src}"`);
            }

            const raw = fs.readFileSync(absPath, 'utf-8');
            const { vars: compVars, ranges } = extractVars(raw);
            const cleaned = stripVars(raw, ranges);
            const finalHtml = interpolatePrimitives(cleaned, compVars);
            const escaped = finalHtml
                .replace(/\\/g, '\\\\')
                .replace(/`/g, '\\`')
                .replace(/\$\{/g, '\\${');

            return `  document.querySelector('${call.sel}').innerHTML = \`${escaped}\`;`;
        }

        // Case 2: Variable from current file
        if (!call.file) {
            const entry = vars.get(call.varName);

            if (entry === undefined) {
                throw new Error(`cygnus build: *${call.varName} is not defined in this file`);
            }

            const html = typeof entry === 'object' ? entry.value : entry;
            const escaped = html
                .replace(/\\/g, '\\\\')
                .replace(/`/g, '\\`')
                .replace(/\$\{/g, '\\${');

            return `  document.querySelector('${call.sel}').innerHTML = \`${escaped}\`;`;
        }

        // Case 3: Variable from another file → read and extract at compile time
        const absPath = path.resolve(fileDir, call.file);
        const raw = fs.readFileSync(absPath, 'utf-8');
        const html = extractVarFromFile(raw, call.varName, call.file);
        const escaped = html
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$\{/g, '\\${');

        return `  document.querySelector('${call.sel}').innerHTML = \`${escaped}\`;`;
    }).join('\n');

    const togglePart = needsToggle ? `${TOGGLE_FN}\n` : '';
    const bodyPart   = lines
        ? `  document.addEventListener('DOMContentLoaded', () => {\n${lines}\n  });`
        : '';

    return `  <script>\n${togglePart}${bodyPart}\n  </script>`;
};

/**
 * Build complete <head> block from @name() configuration.
 *
 * @param {Object|null} name - Name configuration object
 * @param {string} name.title - Document title
 * @param {string|null} name.favicon - Favicon path or null
 * @returns {string} Complete <head> block as HTML string
 */
const buildHead = (name) => {
    if (!name) return '';

    const { title, favicon } = name;
    const faviconTag = favicon ? `\n    <link rel="icon" href="${favicon}">` : '';

    return `  <head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>${faviconTag}
  </head>`;
};

/**
 * Build <link rel="stylesheet"> tags from @using CSS calls.
 *
 * @param {string[]} cssLinks - Array of CSS file paths
 * @returns {string} Concatenated link tags as HTML string
 */
const buildCssLinks = (cssLinks = []) => {
    if (!cssLinks.length) return '';

    return cssLinks
        .map(href => `    <link rel="stylesheet" href="${href}">`)
        .join('\n');
};

/**
 * Inject CSS <link> tags into the <head> section.
 * Creates an empty <head> if none exists.
 *
 * @param {string} html - HTML content string
 * @param {string} links - CSS link tags to inject
 * @returns {string} Modified HTML with injected links
 */
const injectCssLinks = (html, links) => {
    if (!links) return html;

    if (html.includes('</head>')) {
        return html.replace('</head>', `${links}\n  </head>`);
    }

    return html.replace('<body', `  <head>\n${links}\n  </head>\n  <body`);
};

/**
 * Inject script tag into <head> or before <body>.
 *
 * @param {string} html - HTML content string
 * @param {string} script - Script tag to inject
 * @returns {string} Modified HTML with injected script
 */
const injectScript = (html, script) => {
    if (!script) return html;

    if (html.includes('</head>')) {
        return html.replace('</head>', `${script}\n  </head>`);
    }

    return html.replace('<body>', `<body>\n${script}`);
};

/**
 * Inject <head> block before <body> if no <head> exists.
 *
 * @param {string} html - HTML content string
 * @param {string} head - Head block to inject
 * @returns {string} Modified HTML with injected head
 */
const injectHead = (html, head) => {
    if (!head) return html;
    if (html.includes('<head')) return html;

    return html.replace('<body', `${head}\n  <body`);
};

/**
 * Rebuild complete HTML document.
 * Dev mode: runtime fetch via using(). Build mode: compile-time inline.
 *
 * @param {string} content - Inner HTML content
 * @param {string} lang - HTML lang attribute (e.g., 'lang="en"')
 * @param {Array<Object>} calls - Array of using() call objects
 * @param {Object} opts - Options object
 * @param {Map<string, {value: any, type: string}>} opts.vars - Variable map
 * @param {string} opts.getHtmlSrc - Source of getHTML utility (dev only)
 * @param {Object|null} opts.name - Name configuration object
 * @param {string[]} opts.cssLinks - Array of CSS file paths
 * @param {boolean} opts.isBuild - True when running vite build
 * @param {string} opts.fileDir - Directory of source file (build mode only)
 * @returns {string} Complete HTML document
 */
const rebuild = (content, lang, calls, opts = {}) => {
    const vars    = opts.vars    || new Map();
    const isBuild = opts.isBuild || false;
    const fileDir = opts.fileDir || process.cwd();

    const interpolated = interpolatePrimitives(content, vars);

    let script;

    if (isBuild) {
        const needsToggle = /\btoggle\s*\(/.test(interpolated);
        script = buildScriptBuild(calls, vars, fileDir, needsToggle);
    } else {
        script = buildScriptDev(calls, opts.getHtmlSrc, vars);
    }

    const head  = buildHead(opts.name);
    const links = buildCssLinks(opts.cssLinks);

    let out = injectHead(interpolated, head);
    out = injectCssLinks(out, links);
    out = injectScript(out, script);

    return `<!DOCTYPE html>\n<html ${lang}>\n${out}\n</html>`;
};

export { rebuild };