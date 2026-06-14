// @fileoverview parse using() calls, name() head config, and strip boilerplate from .html source

/**
 * Regex to match using() calls.
 *
 * param2 can be:
 * - 'string' (quoted string)
 * - *varname (no quotes, variable reference)
 * - CSS (special keyword, no quotes)
 *
 * param3 (file) is optional used when param2 is *varname from another file
 */
const USING_RE = /using\(\s*(CSS|['"](?:.+?)['"])\s*,\s*(\*[\p{L}_][\p{L}\p{M}\p{N}_]*|['"](?:.+?)['"])\s*(?:,\s*['"](.+?)['"]\s*)?\)/gu;
const NAME_RE = /name\(\s*['"](.+?)['"]\s*(?:,\s*['"](.+?)['"]\s*)?\)/;

// Regex for stripping HTML boilerplate.
const DOCTYPE_RE = /<!DOCTYPE\s+html>\s*/i;
const HTML_OPEN_RE = /<html([^>]*)>\s*/i;
const HTML_CLOSE_RE = /\s*<\/html>/i;

/**
 * Extract using() calls that appear before the <html> tag.
 * @param {string} raw - Raw HTML source code
 * @returns {Array<Object>} Array of call objects
 * @description
 * 
 * Returns objects in two possible formats:
 * - { sel, src }            Load from normal file
 * - { sel, varName, file }  Load from *name variable (file = null if same file)
 * Note: using(CSS, 'file.css') is NOT included in calls extracted separately by extractCssLinks()
 */
const extractCalls = (raw) => {
    const beforeHtml = raw.split(/<html/i)[0];
    const calls = [];
    let match;

    USING_RE.lastIndex = 0;
    
    while ((match = USING_RE.exec(beforeHtml)) !== null) {
        const param1 = match[1].trim();

        // using(CSS, ...) is not DOM injection skip here
        if (param1 === 'CSS') continue;

        const sel = param1.slice(1, -1); // strip quotes
        const param2 = match[2].trim();
        const file = match[3] || null;

        if (param2.startsWith('*')) {
            calls.push({
                sel: sel,
                varName: param2.slice(1),
                file: file
            });
        } else {
            const src = param2.slice(1, -1);
            
            calls.push({
                sel: sel,
                src: src
            });
        }
    }

    return calls;
};

/**
 * Extract using(CSS, 'file.css') calls that appear before the <html> tag.
 * @param {string} raw - Raw HTML source code
 * @returns {string[]} Array of CSS file paths (e.g., ['dialog.css'])
 */
const extractCssLinks = (raw) => {
    const beforeHtml = raw.split(/<html/i)[0];
    const links = [];
    let match;

    USING_RE.lastIndex = 0;
    
    while ((match = USING_RE.exec(beforeHtml)) !== null) {
        const param1 = match[1].trim();
        
        if (param1 !== 'CSS') continue;

        const param2 = match[2].trim();
        
        links.push(param2.slice(1, -1)); // strip quotes
    }

    return links;
};

/**
 * Extract name() call that appears before the <html> tag.
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
 * Strip using()/name() calls, <!DOCTYPE html>, <html>, </html>.
 * Returns only the inner content.
 *
 * @param {string} raw - Raw HTML source code
 * @returns {{content: string, lang: string}} Object with content and lang attribute
 *
 * @description
 * - Removes everything before <html> (where using()/name() calls live)
 * - Strips DOCTYPE declaration
 * - Extracts lang attribute from <html> tag
 * - Removes opening and closing <html> tags
 */
const strip = (raw) => {
    // Remove everything before <html> (using()/name() calls live here)
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