// @fileoverview parse *name.create(<html>) and *name = value variable declarations

/**
 * Get line number, column, and surrounding lines from a raw string at a given index.
 * @param {string} raw
 * @param {number} index - character index of the error
 * @returns {{ line: number, col: number, lines: string[] }}
 */
const getPosition = (raw, index) => {
    const before = raw.slice(0, index);
    const linesBefore = before.split('\n');
    const line = linesBefore.length;
    const col = linesBefore[linesBefore.length - 1].length + 1;
    const allLines = raw.split('\n');

    return { line, col, allLines };
};

/**
 * Throw a structured CygnusError with location info attached.
 * @param {string} message
 * @param {string} raw - full source (with comments intact, for display)
 * @param {number} index - char index of the offending token
 * @param {string} fix - suggestion message
 * @param {string} fixCode - pseudo-code suggestion
 */
const throwAt = (message, raw, index, fix = '', fixCode = '') => {
    const { line, col, allLines } = getPosition(raw, index);
    const err = new Error(message);

    err.cygnusError = {
        line,
        col,
        allLines,
        fix,
        fixCode
    };

    throw err;
};

/**
 * Mask HTML comments <!-- ... --> with spaces (preserving length and newlines).
 * This keeps every character index identical to the original string, so
 * line/col positions reported in errors still point at the real source —
 * while content inside comments is invisible to the variable scanners.
 *
 * @param {string} raw
 * @returns {string} same length as raw, with comment bodies replaced by spaces
 */
const maskComments = (raw) => {
    const COMMENT_RE = /<!--[\s\S]*?-->/g;

    return raw.replace(COMMENT_RE, (match) => {
        return match.replace(/[^\n]/g, ' ');
    });
};

/**
 * Find all *name.create( ... ) calls in the given (already comment-masked) string.
 */
const findCreateCalls = (masked) => {
    const HEAD_RE = /\*([A-Za-z_][A-Za-z0-9_]*)\.create\(/g;
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
            calls.push({ name, unclosed: true, start: match.index });
            continue;
        }

        let html = masked.slice(openIdx + 1, i).trim();
        let end = i + 1;

        if (masked[end] === ';') end++;

        calls.push({
            name,
            html,
            start: match.index,
            end
        });
    }

    return calls;
};

/**
 * Find all *name = value; primitive declarations in the given (masked) string.
 * Supports: number, 'string', "string"
 */
const findPrimitiveVars = (masked) => {
    const PRIM_RE = /\*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?!.*\.create\()(['"])((?:(?!\2).)*)\2\s*;|\*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(-?[0-9]+(?:\.[0-9]+)?)\s*;/g;
    const results = [];
    let match;

    while ((match = PRIM_RE.exec(masked)) !== null) {
        if (match[1] !== undefined) {
            results.push({
                name: match[1],
                value: match[3],
                raw: match[0],
                start: match.index,
                end: match.index + match[0].length,
                type: 'string'
            });
        } else if (match[4] !== undefined) {
            results.push({
                name: match[4],
                value: Number(match[5]),
                raw: match[0],
                start: match.index,
                end: match.index + match[0].length,
                type: 'number'
            });
        }
    }

    return results;
};

/**
 * Extract all variables from the raw file content.
 * HTML comments <!-- ... --> are masked before scanning, so commented-out
 * declarations are ignored entirely (no duplicate errors, never stripped).
 * Throws a structured CygnusError on duplicate names.
 *
 * @param {string} raw - original file content (used as-is for error display)
 */
const extractVars = (raw) => {
    const masked = maskComments(raw);

    const createCalls = findCreateCalls(masked);
    const primitives = findPrimitiveVars(masked);

    const vars = new Map();
    const ranges = [];

    for (const { name, html, start, end, unclosed } of createCalls) {
        if (unclosed) {
            throwAt(
                `cygnus: unclosed *${name}.create( ... )`,
                raw,
                start,
                'Add a closing parenthesis at the end of the declaration.',
                `*${name}.create(<div>...</div>);`
            );
        }

        if (vars.has(name)) {
            throwAt(
                `cygnus: duplicate variable *${name}`,
                raw,
                start,
                `Variable names must be unique. Rename, remove, or comment out the duplicate.`,
                `<!-- *${name}.create(...); -->  // comment out\n// or rename to *${name}2`
            );
        }

        vars.set(name, {
            value: html,
            type: 'html'
        });

        ranges.push({ start, end });
    }

    for (const { name, value, type, start, end } of primitives) {
        if (vars.has(name)) {
            throwAt(
                `cygnus: duplicate variable *${name}`,
                raw,
                start,
                `Variable names must be unique. Rename, remove, or comment out the duplicate.`,
                type === 'string'
                    ? `<!-- *${name} = ${JSON.stringify(value)}; -->  // comment out\n// or rename to *${name}2`
                    : `<!-- *${name} = ${value}; -->  // comment out\n// or rename to *${name}2`
            );
        }

        vars.set(name, { value, type });
        ranges.push({ start, end });
    }

    return { vars, ranges };
};

/**
 * Replace *varName text references in HTML with their values.
 */
const interpolatePrimitives = (html, vars) => {
    let out = html;

    for (const [name, { value, type }] of vars) {
        if (type === 'html') continue;

        const REF_RE = new RegExp(`\\*${name}(?!\\.create|\\s*=)`, 'g');
        out = out.replace(REF_RE, String(value));
    }

    return out;
};

/**
 * Remove all variable declarations from the raw string.
 */
const stripVars = (raw, ranges) => {
    const sorted = [...ranges].sort((a, b) => b.start - a.start);
    let out = raw;

    for (const { start, end } of sorted) {
        out = out.slice(0, start) + out.slice(end);
    }

    return out;
};

const VAR_REF_RE = /^\*([A-Za-z_][A-Za-z0-9_]*)$/;

const isVarRef = (token) => VAR_REF_RE.test(token.trim());

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