// @fileoverview Cygnus build error overlay - multi-error 3-panel diagnostic + typing effect

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
 * Escape HTML special chars.
 *
 * @param {string} str - text to escape
 * @returns {string} escaped text
 */
const esc = (str) => String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/**
 * Build code frame: 2 lines before error, error line, 2 lines after.
 *
 * @param {string[]} allLines - all source code lines
 * @param {number} errorLine - line number where error happened
 * @returns {string} HTML of the code frame
 */
const buildCodeFrame = (allLines, errorLine) => {
    const from = Math.max(0, errorLine - 3);
    const to = Math.min(allLines.length - 1, errorLine + 1);

    return allLines.slice(from, to + 1).map((lineStr, i) => {
        const lineNum = from + i + 1;
        const isError = lineNum === errorLine;
        const numStr = String(lineNum).padStart(3, ' ');
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
 * Build one 3-panel block for a single error.
 *
 * @param {Object} info - error info object
 * @param {number} info.line - line of error
 * @param {number} info.col - column of error
 * @param {string} info.fix - how to fix it
 * @param {string} info.fixCode - example code
 * @param {string[]} info.allLines - all source lines
 * @param {string} message - error message
 * @param {number} index - error number (0 = first)
 * @returns {string} HTML of the 3-panel block
 */
const buildPanelsBlock = (info, message, index) => {
    const line = info.line || '?';
    const col = info.col || '?';
    const fix = esc(info.fix || 'Check the Cygnus syntax reference.');
    const fixCode = esc(info.fixCode || '');
    
    const frame = info.allLines
        ? buildCodeFrame(info.allLines, info.line)
        : `<div class="line"><span class="ln">  ?</span><span class="code">source unavailable</span></div>`;

    const fixCodeBlock = fixCode
        ? `<div class="fix-code">${fixCode}</div>`
        : '';

    // first error gets typing animation, others show right away
    const msgId = `cy-msg-${index}`;
    const msgAttr = index === 0
        ? `id="${msgId}" class="error-msg"`
        : `class="error-msg error-msg-plain"`;

    return `
        <div class="panels">
            <div class="panel">
                <p class="panel-title">
                    Error ${index + 1}
                    &nbsp;
                    <span class="loc-inline">line ${line} &nbsp; col ${col}</span>
                </p>
                <p ${msgAttr}>
                    ${index === 0 ? '' : esc(message)}
                </p>
            </div>
            <div class="panel">
                <p class="panel-title">Source</p>
                <div class="frame">${frame}</div>
            </div>
            <div class="panel">
                <p class="panel-title">How to fix</p>
                <p class="fix-text">${fix}</p>
                ${fixCodeBlock}
            </div>
        </div>
        <hr class="divider">`;
};

/**
 * Build full error page HTML.
 * Supports both single error (.cygnusError) and multiple errors (.cygnusErrors).
 *
 * @param {Error} err - error with cygnusError or cygnusErrors
 * @returns {string} complete HTML page
 */
const buildErrorOverlay = (err) => {
    // handle single error or multiple errors
    const infos = err.cygnusErrors
        ? err.cygnusErrors
        : [err.cygnusError || {}];

    const messages = err.message.split('\n');

    const errorsHtml = infos
        .map((info, i) => buildPanelsBlock(info, messages[i] || err.message, i))
        .join('\n');

    const firstMsg = esc(messages[0] || err.message);

    const firstInfo = infos[0] || {};
    const line = firstInfo.line || '?';
    const col = firstInfo.col || '?';

    const errorCount = infos.length > 1
        ? `${infos.length} errors`
        : 'build error';

    const css = readFileSync(CSS_PATH, 'utf-8');

    return HTML_TEMPLATE
        .replace('__OVERLAY_CSS__', `data:text/css;charset=utf-8,${encodeURIComponent(css)}`)
        .replace('__ERROR_COUNT__', errorCount)
        .replace('__LINE__', String(line))
        .replace('__COL__', String(col))
        .replace('__ERRORS_HTML__', errorsHtml)
        .replace('__MSG_JSON__', JSON.stringify(firstMsg));
};

export { buildErrorOverlay };