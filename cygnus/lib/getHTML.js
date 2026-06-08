// @fileoverview fetch a .html file and inject it into a target DOM element

const UNSAFE_TAGS = ['script', 'iframe', 'object', 'embed', 'base'];

const sanitize = html => html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/ on\w+=\s*["'][^"']*["']/gi, '')
    .replace(/ href=\s*["']javascript:[^"']*["']/gi, ' href="#"')
    .replace(/ src=\s*["']javascript:[^"']*["']/gi, ' src="#"');

const stripEvents = node => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    node.getAttributeNames()
        .filter(a => a.startsWith('on') && a.length > 2)
        .forEach(a => node.removeAttribute(a));

    [...node.children].forEach(stripEvents);
};

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

const insert = (target, frag, mode = 'replace') => {
    if (mode === 'append') return target.appendChild(frag);
    if (mode === 'prepend') return target.insertBefore(frag, target.firstChild);

    while (target.firstChild) {
        target.removeChild(target.firstChild);
    }

    target.appendChild(frag);
};

const using = async (sel, path, opts = {}) => {
    const { mode = 'replace', onError = console.error } = opts;

    try {
        const el = document.querySelector(sel);
        if (!el) throw new Error(`using: no element matches "${sel}"`);

        const res = await fetch(path);
        if (!res.ok) {
            throw new Error(`using: fetch failed "${path}" (${res.status})`);
        }

        const html = sanitize(await res.text());
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
            if (isSafe(node)) frag.appendChild(node.cloneNode(true));
            imported.removeChild(node);
        }

        insert(el, frag, mode);
        return el;

    } catch (err) {
        onError(err);
        throw err;
    }
};

// bind to globalThis immediately so using() is available across all modules
globalThis.using = using;

export default using;