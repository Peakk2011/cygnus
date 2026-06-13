// @fileoverview parse *name.create(<html>) variable declarations preprocess-time only

/**
 * Find all *name.create( ... ) calls in the raw string.
 * Handles balanced parentheses because inner HTML may contain attributes with ().
 *
 * @param {string} raw - Raw source code string
 * @returns {Array<{name: string, html: string, start: number, end: number}>}
 *          Array of calls with variable name, HTML content, and indices
 * @throws {Error} If any .create() call has unclosed parentheses
 */
const findCreateCalls = (raw) => {
    const HEAD_RE = /\*([A-Za-z_][A-Za-z0-9_]*)\.create\(/g;
    const calls = [];
    let match;

    while ((match = HEAD_RE.exec(raw)) !== null) {
        const name = match[1];
        const openIdx = match.index + match[0].length - 1; // index of '('
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
            throw new Error(`cygnus: unclosed *${name}.create( ... )`);
        }

        // content inside ( ... ) strip parentheses then trim
        let html = raw.slice(openIdx + 1, i).trim();

        // look for trailing semicolon and include it in end index
        let end = i + 1;
        if (raw[end] === ';') end++;

        calls.push({ name, html, start: match.index, end });
    }

    return calls;
};

/**
 * Extract all variables from the raw file content.
 * Throws an error if duplicate variable names are found.
 *
 * @param {string} raw - Raw source code string
 * @returns {{vars: Map<string, string>, ranges: Array<{start: number, end: number}>}}
 *          Map of variable names to HTML content, and ranges to strip later
 * @throws {Error} If duplicate variable names exist
 */
const extractVars = (raw) => {
    const calls = findCreateCalls(raw);
    const vars = new Map();
    const ranges = [];

    for (const { name, html, start, end } of calls) {
        if (vars.has(name)) {
            throw new Error(
                `cygnus: duplicate variable *${name} names must be unique`
            );
        }
        vars.set(name, html);
        ranges.push({ start, end });
    }

    return { vars, ranges };
};

/**
 * Remove *name.create(...) calls from the raw string.
 *
 * @param {string} raw - Raw source code string
 * @param {Array<{start: number, end: number}>} ranges - Ranges to remove
 * @returns {string} Cleaned source code without variable declarations
 */
const stripVars = (raw, ranges) => {
    let out = raw;

    // remove from end to beginning to prevent index shifting
    for (let i = ranges.length - 1; i >= 0; i--) {
        const { start, end } = ranges[i];
        out = out.slice(0, start) + out.slice(end);
    }

    return out;
};

/**
 * Regular expression to match variable references like *name.
 */
const VAR_REF_RE = /^\*([A-Za-z_][A-Za-z0-9_]*)$/;

/**
 * Check if a token is a variable reference (e.g., *name).
 *
 * @param {string} token - Token to check
 * @returns {boolean} True if token matches variable reference pattern
 */
const isVarRef = (token) => VAR_REF_RE.test(token.trim());

/**
 * Extract the variable name from a variable reference token.
 *
 * @param {string} token - Variable reference token (e.g., *name)
 * @returns {string} Variable name without the asterisk
 */
const varRefName = (token) => token.trim().match(VAR_REF_RE)[1];

export {
    findCreateCalls,
    extractVars,
    stripVars,
    isVarRef,
    varRefName
};