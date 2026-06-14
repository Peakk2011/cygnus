// @fileoverview dev server process .html files on request

import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { extractCalls, extractCssLinks, extractName, strip } from './parse.js';
import { extractVars, stripVars } from './vars.js';
import { rebuild } from './inject.js';
import { buildErrorOverlay } from './error-overlay.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const getHtmlSrc = fs.readFileSync(
    path.join(__dirname, 'getHTML.js'),
    'utf-8'
);

/**
 * MIME type mappings for common file extensions.
 */
const MIMES = {
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

/**
 * Process an HTML file by extracting variables, parsing calls, and rebuilding.
 *
 * @param {string} filePath - Path to the HTML file to process
 * @returns {string} Processed HTML content
 *
 * @description
 * - Component/var files (no <html> tag) serve raw files directly.
 * - using() runtime will parse *name.create() from the raw file itself.
 * - Extracts variables from the entire raw file (can be declared before or after <html>).
 */
const processHtml = (filePath) => {
    const raw = fs.readFileSync(filePath, 'utf-8');

    /*
        component/var file (no <html) serves raw files directly
        using() runtime will parse *name.create() from the raw file itself
    */
    if (!/<html/i.test(raw)) {
        return raw;
    }

    // Extract variables from the entire raw file
    // They can be declared before or after <html>
    const { vars, ranges } = extractVars(raw);
    const rawClean = stripVars(raw, ranges);

    const calls = extractCalls(rawClean);
    const cssLinks = extractCssLinks(rawClean);
    const name = extractName(rawClean);
    const { content, lang } = strip(rawClean);

    return rebuild(
        content,
        lang,
        calls,
        {
            getHtmlSrc: getHtmlSrc,
            name: name,
            vars: vars,
            cssLinks: cssLinks
        }
    );
};

/**
 * Start a development server that processes .html files on request.
 * @param {string} dir - Root directory to serve (default: '.')
 * @param {number} port - Port number to listen on (default: 3000)
 */
const serve = (dir = '.', port = 3000) => {
    const server = createServer((req, res) => {
        const url = req.url.split('?')[0];
        const filePath = path.join(dir, url === '/' ? 'index.html' : url);
        const ext = path.extname(filePath) || '.html';

        if (!fs.existsSync(filePath)) {
            res.writeHead(404);
            return res.end('Not found');
        }

        if (ext === '.html') {
            try {
                const result = processHtml(filePath);
                res.writeHead(200, { 'Content-Type': 'text/html' });
                return res.end(result);
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'text/html' });
                return res.end(buildErrorOverlay(err));
            }
        }

        res.writeHead(200, { 'Content-Type': MIMES[ext] || 'text/plain' });
        fs.createReadStream(filePath).pipe(res);
    });

    server.listen(port, () => {
        console.log(`cygnus run in: http://localhost:${port}`);
    });
};

export {
    serve,
    processHtml
};