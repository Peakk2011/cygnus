// @fileoverview parse *name.create(<html>) and *name = value variable declarations

/**
 * Get line number, column, and surrounding lines from a raw string at a given index.
 *
 * @param {string} raw - Full source code string
 * @param {number} index - Character index of the error location
 * @returns {{ line: number, col: number, allLines: string[] }}
 *          Line number, column number, and all lines of the source
 */
const getPosition = (raw, index) => {
    const before = raw.slice(0, index);
    const linesBefore = before.split('\n');
    const line = linesBefore.length;
    const col = linesBefore[linesBefore.length - 1].length + 1;
    const allLines = raw.split('\n');

    return {
        line: line,
        col: col,
        allLines: allLines
    };
};

/**
 * Build a structured cygnusError object (without throwing).
 *
 * @param {string} message - Error message
 * @param {string} raw - Full source code string
 * @param {number} index - Character index of the error location
 * @param {string} fix - Human-readable fix suggestion (default: '')
 * @param {string} fixCode - Code example suggestion (default: '')
 * @returns {Error} Error object with cygnusError property
 */
const makeError = (message, raw, index, fix = '', fixCode = '') => {
    const { line, col, allLines } = getPosition(raw, index);
    const err = new Error(message);

    err.cygnusError = {
        line: line,
        col: col,
        allLines: allLines,
        fix: fix,
        fixCode: fixCode
    };

    return err;
};

/**
 * Throw a single structured CygnusError.
 * Kept for cases where only one error is possible (e.g. unclosed paren).
 * @param {string} message - Error message
 * @param {string} raw - Full source code string
 * @param {number} index - Character index of the error location
 * @param {string} fix - Human-readable fix suggestion (default: '')
 * @param {string} fixCode - Code example suggestion (default: '')
 * @throws {Error} Error with cygnusError property
 */
const throwAt = (message, raw, index, fix = '', fixCode = '') => {
    throw makeError(message, raw, index, fix, fixCode);
};

/**
 * Mask HTML comments <!-- ... --> with spaces (preserving length and newlines).
 * Keeps every character index identical to the original string so
 * line/col positions reported in errors still point at the real source.
 *
 * @param {string} raw - Raw source code string
 * @returns {string} Raw string with comment contents replaced by spaces
 */
const maskComments = (raw) => {
    const COMMENT_RE = /<!--[\s\S]*?-->/g;

    return raw.replace(COMMENT_RE, (match) => {
        return match.replace(/[^\n]/g, ' ');
    });
};

/**
 * Find all *name.create( ... ) calls in the given (already comment-masked) string.
 * Supports Unicode variable names (Thai, Japanese, Arabic, etc.)
 *
 * @param {string} masked - Comment-masked source code string
 * @returns {Array<{name: string, html?: string, start: number, end?: number, unclosed?: boolean}>}
 *          Array of create calls with their positions and content
 */
const findCreateCalls = (masked) => {
    const HEAD_RE = /\*([\p{L}_][\p{L}\p{M}\p{N}_]*)\.create\(/gu;
    const calls = [];
    let match;

    while ((match = HEAD_RE.exec(masked)) !== null) {
        const name = match[1];
        const openIdx = match.index + match[0].length - 1;
        let depth = 0;
        let i = openIdx;

        for (; i < masked.length; i++) {
            if (masked[i] === '(') depth++;

            if (masked[i] === ')') {
                depth--;

                if (depth === 0) break;
            }
        }

        if (depth !== 0) {
            calls.push({
                name: name,
                unclosed: true,
                start: match.index
            });

            continue;
        }

        const html = masked.slice(openIdx + 1, i).trim();
        let end = i + 1;

        if (masked[end] === ';') end++;

        calls.push({
            name: name,
            html: html,
            start: match.index,
            end: end
        });
    }

    return calls;
};

/**
 * Find all *name = value; primitive declarations.
 * Supports: number, 'string', "string" and Unicode variable names.
 * @param {string} masked - Comment-masked source code string
 * @returns {Array<{name: string, value: string|number, raw: string, start: number, end: number, type: string}>}
 *          Array of primitive variable declarations
 */
const findPrimitiveVars = (masked) => {
    const STR_RE = /\*([\p{L}_][\p{L}\p{M}\p{N}_]*)\s*=\s*(['"])((?:(?!\2).)*)\2\s*;/gu;
    const NUM_RE = /\*([\p{L}_][\p{L}\p{M}\p{N}_]*)\s*=\s*(-?[0-9]+(?:\.[0-9]+)?)\s*;/gu;
    const results = [];
    let match;

    while ((match = STR_RE.exec(masked)) !== null) {
        if (/\.create\(/.test(match[0])) continue;

        results.push({
            name: match[1],
            value: match[3],
            raw: match[0],
            start: match.index,
            end: match.index + match[0].length,
            type: 'string'
        });
    }

    while ((match = NUM_RE.exec(masked)) !== null) {
        results.push({
            name: match[1],
            value: Number(match[2]),
            raw: match[0],
            start: match.index,
            end: match.index + match[0].length,
            type: 'number'
        });
    }

    results.sort((a, b) => a.start - b.start);

    return results;
};

/**
 * Extract all variables from the raw file content.
 * @param {string} raw - Raw source code string
 * @returns {{ vars: Map<string, {value: any, type: string}>, ranges: Array<{start: number, end: number}> }}
 * @throws {Error} Combined error with cygnusErrors array
 */
const extractVars = (raw) => {
    const masked = maskComments(raw);
    const createCalls = findCreateCalls(masked);
    const primitives = findPrimitiveVars(masked);

    const vars = new Map();
    const ranges = [];
    const errors = [];   // collect, don't throw immediately

    for (const { name, html, start, end, unclosed } of createCalls) {
        if (unclosed) {
            errors.push(
                makeError(
                    `cygnus: unclosed *${name}.create( ... )`,
                    raw,
                    start,
                    'Add a closing parenthesis at the end of the declaration.',
                    `*${name}.create(<div>...</div>);`
                )
            );

            continue;
        }

        if (vars.has(name)) {
            errors.push(
                makeError(
                    `cygnus: duplicate variable *${name}`,
                    raw,
                    start,
                    'Variable names must be unique. Rename, remove, or comment out the duplicate.',
                    `<!-- *${name}.create(...); -->  // comment out\n// or rename to *${name}2`
                )
            );

            continue;
        }

        vars.set(
            name,
            {
                value: html,
                type: 'html'
            }
        );

        ranges.push({ start: start, end: end });
    }

    for (const { name, value, type, start, end } of primitives) {
        if (vars.has(name)) {
            errors.push(
                makeError(
                    `cygnus: duplicate variable *${name}`,
                    raw,
                    start,
                    'Variable names must be unique. Rename, remove, or comment out the duplicate.',
                    type === 'string'
                        ? `<!-- *${name} = ${JSON.stringify(value)}; -->  // comment out\n// or rename to *${name}2`
                        : `<!-- *${name} = ${value}; -->  // comment out\n// or rename to *${name}2`
                )
            );

            continue;
        }

        vars.set(name, { value: value, type: type });
        ranges.push({ start: start, end: end });
    }

    // Throw all collected errors at once
    if (errors.length > 0) {
        const combined = new Error(errors.map(e => e.message).join('\n'));

        combined.cygnusErrors = errors.map(e => e.cygnusError);
        combined.cygnusError = combined.cygnusErrors[0]; // backwards compat

        throw combined;
    }

    return {
        vars: vars,
        ranges: ranges
    };
};

/**
 * Replace *varName text references in HTML with their primitive values.
 * Supports Unicode variable names.
 * @param {string} html - HTML content string
 * @param {Map<string, {value: any, type: string}>} vars - Map of variables
 * @returns {string} HTML with primitive variable references replaced
 */
const interpolatePrimitives = (html, vars) => {
    let out = html;

    for (const [name, { value, type }] of vars) {
        // Remove = We can use variables directly via .create() without needing to use `using` followed by the ID, which is complicated.
        // if (type === 'html') {
        //     continue;
        // }

        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const REF_RE = new RegExp(`\\*${escaped}(?!\\.create|\\s*=)`, 'gu');

        out = out.replace(REF_RE, String(value));
    }

    return out;
};

/**
 * Remove all variable declarations from the raw string
 * @param {string} raw - Raw source code string
 * @param {Array<{start: number, end: number}>} ranges - Ranges to remove
 * @returns {string} Cleaned source code without variable declarations
 */
const stripVars = (raw, ranges) => {
    const sorted = [...ranges].sort((a, b) => b.start - a.start);
    let out = raw;

    for (const { start, end } of sorted) {
        out = out.slice(0, start) + out.slice(end);
    }

    return out;
};

/**
 * Regular expression for matching variable references like *name.
 * Supports Unicode variable names.
 */
const VAR_REF_RE = /^\*([\p{L}_][\p{L}\p{M}\p{N}_]*)$/u;

/**
 * Check if a token is a variable reference (e.g., *name).
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
    findPrimitiveVars,
    extractVars,
    stripVars,
    interpolatePrimitives,
    isVarRef,
    varRefName,
    maskComments
};