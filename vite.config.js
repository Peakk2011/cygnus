import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { extractCalls, strip } from './cygnus/lib/parse.js';
import { rebuild } from './cygnus/lib/inject.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read the getHTML.js source and inline it within the script tag.
const getHtmlSrc = readFileSync(
    path.join(__dirname, 'cygnus/lib/getHTML.js'),
    'utf-8'
);

const cygnusPlugin = () => ({
    name: 'vite-plugin-cygnus',

    transformIndexHtml(html) {
        const calls = extractCalls(html);
        if (!calls.length) return html;
        const { content, lang } = strip(html);
        return rebuild(content, lang, calls, { getHtmlSrc });
    }
});

export default defineConfig({
    root: 'src',
    plugins: [cygnusPlugin()]
});