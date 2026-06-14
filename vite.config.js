import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { extractCalls, extractCssLinks, extractName, strip } from './cygnus/lib/parse.js';
import { extractVars, stripVars } from './cygnus/lib/vars.js';
import { rebuild } from './cygnus/lib/inject.js';
import { buildErrorOverlay } from './cygnus/lib/error-overlay.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read the getHTML.js source and inline it within the script tag.
const getHtmlSrc = readFileSync(
    path.join(__dirname, 'cygnus/lib/getHTML.js'),
    'utf-8'
);

const HAS_DECL_RE = /\*[\p{L}_][\p{L}\p{N}_]*(\.create\(|\s*=\s*)/u;

const cygnusPlugin = () => ({
    name: 'vite-plugin-cygnus',

    transformIndexHtml(html) {
        try {
            const hasVarDecl = HAS_DECL_RE.test(html);
            const calls = extractCalls(html);
            const cssLinks = extractCssLinks(html);
            const name = extractName(html);

            if (!calls.length && !name && !hasVarDecl && !cssLinks.length) {
                return html;
            }

            const { vars, ranges } = extractVars(html);
            const rawClean = stripVars(html, ranges);
            const { content, lang } = strip(rawClean);

            return rebuild(content, lang, calls, {
                getHtmlSrc,
                name,
                vars,
                cssLinks
            });
        } catch (err) {
            return buildErrorOverlay(err);
        }
    }
});

export default defineConfig({
    root: 'src',
    plugins: [cygnusPlugin()]
});