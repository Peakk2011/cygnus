// @fileoverview Cygnus build error overlay — 3-panel diagnostic + typing effect

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
 * Build the code frame (3 lines before, error line, 1 line after).
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
 * - No intro animation — error appears immediately on load
 * - Error message types in character by character with a blinking cursor
 * - Fully responsive — stacks to single column on mobile
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

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cygnus Error</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            background: #0a0a0a;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: 'Geist Mono', monospace;
            padding: 1.5rem;
        }

        /* ── header ── */
        .header {
            background: #000;
            padding: 0.6rem 0.8rem;
            width: 100%;
            max-width: 1100px;
            display: flex;
            align-items: center;
            gap: 0.6rem;
            border-bottom: 1px solid #1a1a1a;
            flex-wrap: wrap;
        }

        .logo {
            background: #F5C800;
            color: #000;
            font-size: 0.65rem;
            font-weight: 500;
            padding: 0.15rem 0.45rem;
            letter-spacing: 0.05em;
            white-space: nowrap;
        }

        .header-label { color: #555; font-size: 0.75rem; }

        .loc {
            margin-left: auto;
            color: #444;
            font-size: 0.72rem;
            white-space: nowrap;
        }

        /* ── 3-column panel (collapses on mobile) ── */
        .panels {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            width: 100%;
            max-width: 1100px;
            background: #000;
            box-shadow: 0 20px 40px rgba(0,0,0,0.6);
        }

        @media (max-width: 900px) {
            .panels {
                grid-template-columns: 1fr 1fr;
            }
            .panel:last-child {
                grid-column: 1 / -1;
                border-top: 1px solid #1a1a1a;
                border-right: none;
            }
        }

        @media (max-width: 560px) {
            .panels {
                grid-template-columns: 1fr;
            }
            .panel {
                border-right: none !important;
                border-top: 1px solid #1a1a1a;
            }
            .panel:first-child { border-top: none; }
        }

        .panel {
            padding: 0.8rem;
            border-right: 1px solid #1a1a1a;
            min-width: 0;
        }
        .panel:last-child { border-right: none; }

        .panel-title {
            color: #444;
            font-size: 0.65rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            margin-bottom: 0.6rem;
        }

        /* ── panel 1: error ── */
        .error-type {
            color: #ff4d4d;
            font-size: 0.7rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            margin-bottom: 0.5rem;
        }

        .error-msg {
            color: #fff;
            font-size: 0.85rem;
            line-height: 1.6;
            word-break: break-word;
            min-height: 1.4em;
        }

        .cursor {
            display: inline-block;
            width: 8px;
            height: 1em;
            background: #ff4d4d;
            margin-left: 2px;
            vertical-align: text-bottom;
            animation: blink 0.75s steps(1) infinite;
        }
        .cursor.done { display: none; }

        @keyframes blink { 50% { opacity: 0; } }

        /* ── panel 2: code frame ── */
        .frame {
            font-size: 0.78rem;
            line-height: 1.7;
            overflow-x: auto;
        }

        .line { display: flex; gap: 0.75rem; }

        .ln {
            color: #333;
            user-select: none;
            min-width: 2rem;
            text-align: right;
            flex-shrink: 0;
        }

        .code {
            color: #888;
            white-space: pre;
        }

        .error-line .ln { color: #ff4d4d; }

        .err-code {
            color: #ffa4a4;
            text-decoration: underline wavy #ff4d4d;
            text-underline-offset: 3px;
        }

        /* ── panel 3: fix ── */
        .fix-text {
            color: #aaa;
            font-size: 0.8rem;
            line-height: 1.6;
            margin-bottom: 0.7rem;
            word-break: break-word;
        }

        .fix-code {
            background: #0d0d0d;
            border-left: 2px solid #F5C800;
            padding: 0.5rem 0.7rem;
            color: #ccc;
            font-size: 0.78rem;
            line-height: 1.6;
            white-space: pre;
            overflow-x: auto;
        }
    </style>
</head>
<body>

    <div class="header">
        <span class="logo">CYGNUS</span>
        <span class="header-label">build error</span>
        <span class="loc">line ${line} &nbsp; col ${col}</span>
    </div>

    <div class="panels">

        <div class="panel">
            <p class="panel-title">Error</p>
            <p class="error-type">error</p>
            <p class="error-msg" id="cy-msg"></p>
        </div>

        <div class="panel">
            <p class="panel-title">Source</p>
            <div class="frame">${frame}</div>
        </div>

        <div class="panel">
            <p class="panel-title">How to fix</p>
            <p class="fix-text">${fix}</p>
            ${fixCode ? `<div class="fix-code">${fixCode}</div>` : ''}
        </div>

    </div>

    <script>
        const MSG    = ${JSON.stringify(message)};
        const target = document.getElementById('cy-msg');
        const cursor = document.createElement('span');
        cursor.className = 'cursor';
        target.appendChild(cursor);

        let i = 0;
        const tick = () => {
            if (i >= MSG.length) {
                cursor.classList.add('done');
                return;
            }
            const span = document.createElement('span');
            span.textContent = MSG[i];
            target.insertBefore(span, cursor);
            i++;
            setTimeout(tick, 22);
        };

        tick();
    </script>

</body>
</html>`;
};

export { buildErrorOverlay };