// @fileoverview rebuild complete HTML - inject DOCTYPE, <html>, <head>, and using() script

/**
 * Build inline script that executes using() calls on DOMContentLoaded.
 * @param {Array<Object>} calls - Array of using() call objects
 * @param {string} getHtmlSrc - Source code of getHTML utility (inlined directly)
 * @param {Map<string, string>} vars - Map of variable names to HTML content for current file
 * @returns {string} Inline script as HTML string
 * @throws {Error} If a variable reference is not defined in current file
 */
const buildScript = (calls, getHtmlSrc = '', vars = new Map()) => {
    if (!calls.length) return '';

    const lines = calls.map((call) => {
        if (call.src !== undefined) {
            return `    await using('${call.sel}', '${call.src}');`;
        }

        if (!call.file) {
            const html = vars.get(call.varName);
            
            if (html === undefined) {
                throw new Error(
                    `cygnus: *${call.varName} is not defined in this file`
                );
            }
            
            // Insert directly via innerHTML - no fetch needed
            const escaped = html
                .replace(/`/g, '\\`')
                .replace(/\$\{/g, '\\${');
            
            return `    document.querySelector('${call.sel}').innerHTML = \`${escaped}\`;`;
        }

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
 * Build complete <head> block from name() configuration.
 * @param {Object|null} name - Name configuration object
 * @param {string} name.title - Document title
 * @param {string|null} name.favicon - Favicon path or null
 * @returns {string} Complete <head> block as HTML string
 */
const buildHead = (name) => {
    if (!name) return '';

    const { title, favicon } = name;
    const faviconTag = favicon
        ? `\n    <link rel="icon" href="${favicon}">`
        : '';

    return `  <head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>${faviconTag}
  </head>`;
};

/**
 * Build <link rel="stylesheet"> tags from using(CSS, 'file.css') calls.
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
 * @param {string} html - HTML content string
 * @param {string} links - CSS link tags to inject
 * @returns {string} Modified HTML with injected links
 */
const injectCssLinks = (html, links) => {
    if (!links) return html;

    if (html.includes('</head>')) {
        return html.replace('</head>', `${links}\n  </head>`);
    }

    // No <head> at all - create empty <head> before <body>
    return html.replace('<body', `  <head>\n${links}\n  </head>\n  <body`);
};

/**
 * Inject script tag before closing </head>.
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
 * Inject <head> block before <body> if no <head> exists in content.
 * @param {string} html - HTML content string
 * @param {string} head - Head block to inject
 * @returns {string} Modified HTML with injected head
 */
const injectHead = (html, head) => {
    if (!head) return html;
    // User wrote their own <head>, don't overwrite
    if (html.includes('<head')) return html;
    
    return html.replace('<body', `${head}\n  <body`);
};

/**
 * Rebuild complete HTML with DOCTYPE, <html>, <head>, and using() script.
 * @param {string} content - Inner HTML content
 * @param {string} lang - HTML lang attribute (e.g., 'lang="en"')
 * @param {Array<Object>} calls - Array of using() call objects
 * @param {Object} opts - Options object
 * @param {string} opts.getHtmlSrc - Source code of getHTML utility
 * @param {Map<string, string>} opts.vars - Map of variable names to HTML content
 * @param {Object|null} opts.name - Name configuration object
 * @param {string[]} opts.cssLinks - Array of CSS file paths from using(CSS, ...)
 * @returns {string} Complete HTML document
 */
const rebuild = (content, lang, calls, opts = {}) => {
    const script = buildScript(calls, opts.getHtmlSrc, opts.vars);
    const head = buildHead(opts.name);
    const links = buildCssLinks(opts.cssLinks);

    let out = injectHead(content, head);
    out = injectCssLinks(out, links);
    out = injectScript(out, script);

    return `<!DOCTYPE html>\n<html ${lang}>\n${out}\n</html>`;
};

export { rebuild };