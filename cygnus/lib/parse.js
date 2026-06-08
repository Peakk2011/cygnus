// @fileoverview parse using() calls and strip boilerplate from .html source

const USING_RE = /using\(\s*['"](.+?)['"]\s*,\s*['"](.+?)['"]\s*\)/g;

const DOCTYPE_RE = /<!DOCTYPE\s+html>\s*/i;
const HTML_OPEN_RE = /<html([^>]*)>\s*/i;
const HTML_CLOSE_RE = /\s*<\/html>/i;

/**
 * Extracts using() calls that appear before the <html> tag.
 * @param {string} raw
 * @returns {Array<{sel: string, src: string}>}
 */
const extractCalls = (raw) => {
    const beforeHtml = raw.split(/<html/i)[0];
    const calls = [];
    let match;

    while ((match = USING_RE.exec(beforeHtml)) !== null) {
        calls.push({ sel: match[1], src: match[2] });
    }

    return calls;
};

/**
 * Strips using() calls, DOCTYPE, and html open/close tags.
 * @param {string} raw
 * @returns {{ content: string, lang: string }}
 */
const strip = (raw) => {
    // remove everything before <html (where using() calls live)
    let out = raw.replace(/^[\s\S]*?(?=<html)/i, '');

    out = out.replace(DOCTYPE_RE, '');

    // capture lang attribute then remove <html ...>
    const langMatch = out.match(HTML_OPEN_RE);
    const lang = langMatch?.[1]?.trim() || 'lang="en"';

    out = out.replace(HTML_OPEN_RE, '');
    out = out.replace(HTML_CLOSE_RE, '');

    return { content: out.trim(), lang };
};

export { extractCalls, strip };