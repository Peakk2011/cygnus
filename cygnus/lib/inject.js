// @fileoverview rebuild complete HTML — inject DOCTYPE, <html>, and using() script

/**
 * Builds an inline <script type="module"> that calls using() for each selector/src pair.
 * @param {Array<{sel: string, src: string}>} calls
 * @param {string} [getHtmlSrc=''] - Source of getHTML module to inline.
 * @returns {string} Script tag string, or empty string if calls is empty.
 */
const buildScript = (calls, getHtmlSrc = '') => {
    if (!calls.length) return '';

    const lines = calls
        .map(({ sel, src }) => `    await using('${sel}', '${src}');`)
        .join('\n');

    return `  <script type="module">
${getHtmlSrc}
    document.addEventListener('DOMContentLoaded', async () => {
${lines}
    });
  </script>`;
};

/**
 * Injects a script tag before </head>; falls back to after <body> if </head> is absent.
 * @param {string} html
 * @param {string} script
 * @returns {string}
 */
const injectScript = (html, script) => {
    if (!script) return html;

    if (html.includes('</head>')) {
        return html.replace('</head>', `${script}\n  </head>`);
    }

    return html.replace('<body>', `<body>\n${script}`);
};

/**
 * Rebuilds a complete HTML document with DOCTYPE, <html>, and injected using() script.
 * @param {string} content
 * @param {string} lang - Value for the lang attribute on <html> (e.g. `lang="en"`).
 * @param {Array<{sel: string, src: string}>} calls
 * @param {{ getHtmlSrc?: string }} [opts={}]
 * @returns {string}
 */
const rebuild = (content, lang, calls, opts = {}) => {
    const script = buildScript(calls, opts.getHtmlSrc);
    const injected = injectScript(content, script);

    return [
        '<!DOCTYPE html>',
        `<html ${lang}>`,
        injected,
        '</html>',
    ].join('\n');
};

export { rebuild };