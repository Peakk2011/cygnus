// @fileoverview parse @using / @name() head config, and strip boilerplate from .html source

/**
 * Regex to match @using CSS stylesheet directives.
 * @using CSS "file.css"  or  @using CSS 'file.css'
 */
const CSS_RE = /@using\s+CSS\s+["'](.+?)["']/gu;

/**
 * Regex to match @using DOM injection directives.
 * Does NOT match CSS directives.
 *
 * File:           @using "#sel" from "./file.html"
 * Var:            @using "#sel" from *varName
 * Var cross-file: @using "#sel" from *varName in "file.html"
 */
const INJECT_RE = /@using\s+["'](.+?)["']\s+from\s+(?:(\*[\p{L}_][\p{L}\p{M}\p{N}_]*)(?:\s+in\s+["'](.+?)["'])?|["'](.+?)["'])/gu;

/**
 * Regex to match @name() calls for document metadata.
 * Supports both single and double quotes.
 */
const NAME_RE = /@name\(\s*["'](.+?)["']\s*(?:,\s*["'](.+?)["']\s*)?\)/;

// Regex for stripping HTML boilerplate.
const DOCTYPE_RE = /<!DOCTYPE\s+html>\s*/i;
const HTML_OPEN_RE = /<html([^>]*)>\s*/i;
const HTML_CLOSE_RE = /\s*<\/html>/i;

/**
 * Extract @using DOM injection calls that appear before the <html> tag.
 * @param {string} raw - Raw HTML source code
 * @returns {Array<Object>} Array of call objects
 * @description
 *
 * Returns objects in two possible formats:
 * - { sel, src }            Load from normal file
 * - { sel, varName, file }  Load from *name variable (file = null if same file)
 * Note: CSS directives are NOT included - extracted separately by extractCssLinks()
 */
const extractCalls = (raw) => {
    const beforeHtml = raw.split(/<html/i)[0];
    const calls = [];
    let match;

    INJECT_RE.lastIndex = 0;

    while ((match = INJECT_RE.exec(beforeHtml)) !== null) {
        // @using "#sel" from *varName (optionally: in "file.html")
        if (match[2]) {
            calls.push({
                sel: match[1],
                varName: match[2].slice(1), // strip *
                file: match[3] || null
            });
            continue;
        }

        // @using "#sel" from "./file.html"
        if (match[4]) {
            calls.push({
                sel: match[1],
                src: match[4]
            });
        }
    }

    return calls;
};

/**
 * Extract @using CSS calls that appear before the <html> tag.
 * @param {string} raw - Raw HTML source code
 * @returns {string[]} Array of CSS file paths (e.g., ['dialog.css'])
 */
const extractCssLinks = (raw) => {
    const beforeHtml = raw.split(/<html/i)[0];
    const links = [];
    let match;

    CSS_RE.lastIndex = 0;

    while ((match = CSS_RE.exec(beforeHtml)) !== null) {
        links.push(match[1]);
    }

    return links;
};

/**
 * Extract @name() call that appears before the <html> tag.
 * @param {string} raw - Raw HTML source code
 * @returns {Object|null} Object with title and favicon, or null if not found
 * @returns {string} return.title - Document title
 * @returns {string|null} return.favicon - Favicon path or null
 */
const extractName = (raw) => {
    const beforeHtml = raw.split(/<html/i)[0];
    const match = beforeHtml.match(NAME_RE);

    if (!match) return null;

    return {
        title: match[1],
        favicon: match[2] || null
    };
};

/**
 * Strip @using/@name() calls, <!DOCTYPE html>, <html>, </html>.
 * Returns only the inner content.
 *
 * @param {string} raw - Raw HTML source code
 * @returns {{content: string, lang: string}} Object with content and lang attribute
 *
 * @description
 * - Removes everything before <html> (where @using/@name() calls live)
 * - Strips DOCTYPE declaration
 * - Extracts lang attribute from <html> tag
 * - Removes opening and closing <html> tags
 */
const strip = (raw) => {
    // Remove everything before <html> (@using/@name() calls live here)
    let out = raw.replace(/^[\s\S]*?(?=<html)/i, '');

    // Remove <!DOCTYPE html> if present
    out = out.replace(DOCTYPE_RE, '');

    // Extract lang attribute then remove <html ...>
    const langMatch = out.match(HTML_OPEN_RE);
    const lang = langMatch?.[1]?.trim() || 'lang="en"';

    out = out.replace(HTML_OPEN_RE, '');
    out = out.replace(HTML_CLOSE_RE, '');

    return {
        content: out.trim(),
        lang: lang
    };
};

export {
    extractCalls,
    extractCssLinks,
    extractName,
    strip
};