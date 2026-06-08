// @fileoverview rebuild complete HTML — inject DOCTYPE, <html>, and using() script

// build inline script — รับ getHTML source มา inline เลย ไม่ต้อง import
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

// inject script ก่อนปิด </head>
const injectScript = (html, script) => {
    if (!script) return html;

    if (html.includes('</head>')) {
        return html.replace('</head>', `${script}\n  </head>`);
    }

    return html.replace('<body>', `<body>\n${script}`);
};

// rebuild HTML เต็มๆ พร้อม DOCTYPE และ <html>
const rebuild = (content, lang, calls, opts = {}) => {
    const script = buildScript(calls, opts.getHtmlSrc);
    const injected = injectScript(content, script);

    return `<!DOCTYPE html>\n<html ${lang}>\n${injected}\n</html>`;
};

export { rebuild };