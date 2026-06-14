// @fileoverview Cygnus build error overlay — 3-panel diagnostic + typing effect

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HTML_TEMPLATE = readFileSync(
    path.join(__dirname, 'error', 'error-overlay.html'),
    'utf-8'
);

const CSS_PATH = path.join(__dirname, 'error', 'error-overlay.css');

/**
 * Escape HTML special characters.
 * @param {string} str
 * @returns {string}
 */
const esc = (str) => String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/**
 * Build the code frame (2 lines before, error line, 2 lines after).
 *
 * @param {string[]} allLines
 * @param {number} errorLine - 1-indexed
 * @returns {string} HTML string
 */
const buildCodeFrame = (allLines, errorLine) => {
    const from = Math.max(0, errorLine - 3);
    const to   = Math.min(allLines.length - 1, errorLine + 1);

    return allLines.slice(from, to + 1).map((lineStr, i) => {
        const lineNum = from + i + 1;
        const isError = lineNum === errorLine;
        const numStr  = String(lineNum).padStart(3, ' ');
        const escaped = esc(lineStr) || '&nbsp;';

        if (isError) {
            return `<div class="line error-line">` +
                `<span class="ln">${numStr}</span>` +
                `<span class="code err-code">${escaped}</span>` +
                `</div>`;
        }

        return `<div class="line">` +
            `<span class="ln">${numStr}</span>` +
            `<span class="code">${escaped}</span>` +
            `</div>`;
    }).join('\n');
};

/**
 * Build a complete Cygnus-styled HTML error page.
 * Reads HTML template and CSS from separate files — no inline fat.
 *
 * @param {Error} err
 * @returns {string} Complete HTML document
 */
const buildErrorOverlay = (err) => {
    const info    = err.cygnusError || {};
    const message = esc(err.message);
    const line    = info.line    || '?';
    const col     = info.col     || '?';
    const fix     = esc(info.fix     || 'Check the Cygnus syntax reference.');
    const fixCode = esc(info.fixCode || '');
    const frame   = info.allLines
        ? buildCodeFrame(info.allLines, info.line)
        : `<div class="line"><span class="ln">  ?</span><span class="code">source unavailable</span></div>`;

    const fixCodeBlock = fixCode
        ? `<div class="fix-code">${fixCode}</div>`
        : '';

    // Read CSS fresh each time — supports hot-edit during dev
    const css = readFileSync(CSS_PATH, 'utf-8');

    return HTML_TEMPLATE
        .replace('__OVERLAY_CSS__', `data:text/css;charset=utf-8,${encodeURIComponent(css)}`)
        .replace('__LINE__',        String(line))
        .replace('__COL__',         String(col))
        .replace('__FRAME__',       frame)
        .replace('__FIX__',         fix)
        .replace('__FIX_CODE__',    fixCodeBlock)
        .replace('__MSG_JSON__',    JSON.stringify(message));
};

export { buildErrorOverlay };