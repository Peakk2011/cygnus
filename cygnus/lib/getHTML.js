// @fileoverview fetch a .html file and inject it into a target DOM element

const UNSAFE_TAGS = ['script', 'iframe', 'object', 'embed', 'base'];

/**
 * @param {string} html - Raw HTML string to sanitize
 * @returns {string} Sanitized HTML string
 */
const sanitize = html => html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/ on\w+=\s*["'][^"']*["']/gi, '')
    .replace(/ href=\s*["']javascript:[^"']*["']/gi, ' href="#"')
    .replace(/ src=\s*["']javascript:[^"']*["']/gi, ' src="#"');

/**
 * @param {Node} node - DOM node to process
 */
const stripEvents = node => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    node.getAttributeNames()
        .filter(a => a.startsWith('on') && a.length > 2)
        .forEach(a => node.removeAttribute(a));

    [...node.children].forEach(stripEvents);
};

/**
 * @param {Node} node - DOM node to validate
 * @returns {boolean} True if node is safe for injection
 */
const isSafe = node => {
    if (node.nodeType === Node.TEXT_NODE) return true;
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    
    if (UNSAFE_TAGS.includes(node.tagName.toLowerCase())) return false;

    return node.getAttributeNames().every(a => {
        if (a.startsWith('on') && a.length > 2) return false;

        if (['href', 'src'].includes(a)) {
            const v = (node.getAttribute(a) || '').toLowerCase();
            return !v.startsWith('javascript:') && !v.startsWith('data:');
        }

        return true;
    });
};

/**
 * Inserts a fragment into a target element using the specified mode.
 * @param {Element} target - Target DOM element
 * @param {DocumentFragment} frag - Fragment to insert
 * @param {'replace'|'append'|'prepend'} mode - Insertion mode
 *   - 'replace': Replaces all existing content (default)
 *   - 'append': Appends after existing content
 *   - 'prepend': Prepends before existing content
 */
const insert = (target, frag, mode = 'replace') => {
    if (mode === 'append') return target.appendChild(frag);
    if (mode === 'prepend') return target.insertBefore(frag, target.firstChild);

    // Replace mode: clear all children then append
    while (target.firstChild) {
        target.removeChild(target.firstChild);
    }
    
    target.appendChild(frag);
};

/**
 * @param {string} raw - Raw source code string
 * @param {string} varName - Variable name to look for (without asterisk)
 * @returns {string|null} Extracted HTML content or null if not found
 */
const extractCreate = (raw, varName) => {
    // Try multiple regex patterns to handle different cases
    let re = new RegExp(`\\*${varName}\\.create\\(`);
    let match = raw.match(re);
    
    // In there are spaces before create
    if (!match) {
        re = new RegExp(`\\*${varName}\\s*\\.\\s*create\\s*\\(`);
        match = raw.match(re);
    }
    
    if (!match) return null;

    const openIdx = match.index + match[0].length - 1; // index of '('
    let depth = 0;
    let i = openIdx;

    // Find the matching closing parenthesis
    for (; i < raw.length; i++) {
        if (raw[i] === '(') depth++;
        if (raw[i] === ')') {
            depth--;
            if (depth === 0) break;
        }
    }

    if (depth !== 0 || i >= raw.length) {
        return null;
    }

    return raw.slice(openIdx + 1, i).trim();
};

/**
 * @param {string} id - Element ID or class name (without dot for class)
 * @param {string} cls - Class to toggle (default: 'active')
 */
const toggle = (id, cls = 'active') => {
    const el = document.getElementById(id) || document.querySelector(`.${id}`);
    
    if (!el) {
        console.error(`toggle: no element matches "${id}"`);
        return;
    }
    
    el.classList.toggle(cls);
};

/**
 * Fetch an HTML file and inject its sanitized content into a target DOM element.
 * @param {string} sel - CSS selector for target element
 * @param {string} path - Path to HTML file to fetch
 * @param {Object} opts - Options object
 * @param {'replace'|'append'|'prepend'} opts.mode - Insertion mode (default: 'replace')
 * @param {Function} opts.onError - Error callback (default: console.error)
 * @param {string|null} opts.varName - Variable name to extract from fetched file
 * @returns {Promise<Element>} The target element
 * @throws {Error} If selector not found, fetch fails, parse fails, or variable not found
 */
const using = async (sel, path, opts = {}) => {
    const {
        mode = 'replace',
        onError = console.error,
        varName = null
    } = opts;

    try {
        const el = document.querySelector(sel);
        if (!el) {
            throw new Error(`using: no element matches "${sel}"`);
        }

        const res = await fetch(path);
        if (!res.ok) {
            throw new Error(`using: fetch failed "${path}" (${res.status})`);
        }

        let html = sanitize(await res.text());

        // If varName specified find *varName.create(...) in fetched file
        if (varName) {
            const extracted = extractCreate(html, varName);
            
            if (extracted === null) {
                // Provide detailed error message with preview of content
                const preview = html.slice(0, 200).replace(/\n/g, ' ');
                throw new Error(
                    `using: *${varName}.create(...) not found in "${path}"\nContent preview: ${preview}...`
                );
            }
            
            html = sanitize(extracted);
        }

        const doc = new DOMParser().parseFromString(
            `<template>${html}</template>`,
            'text/html'
        );

        if (doc.querySelector('parsererror')) {
            throw new Error(`using: parse error in "${path}"`);
        }

        const imported = document.importNode(
            doc.querySelector('template').content,
            true
        );
        
        stripEvents(imported);

        const frag = document.createDocumentFragment();
        
        while (imported.firstChild) {
            const node = imported.firstChild;
            
            if (isSafe(node)) {
                frag.appendChild(node.cloneNode(true));
            }
            
            imported.removeChild(node);
        }

        insert(el, frag, mode);
        return el;

    } catch (err) {
        onError(err);
        throw err;
    }
};

// Bind to globalThis for use without imports
globalThis.using = using;
globalThis.toggle = toggle;

export default using;
export { toggle };