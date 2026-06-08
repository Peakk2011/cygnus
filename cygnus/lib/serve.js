// @fileoverview dev server — process .html files on request

import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { extractCalls, strip } from './parse.js';
import { rebuild } from './inject.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const getHtmlSrc = fs.readFileSync(path.join(__dirname, 'getHTML.js'), 'utf-8');

const MIMES = {
    '.js':   'application/javascript',
    '.css':  'text/css',
    '.json': 'application/json',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
};

/**
 * Reads an HTML file, extracts using() calls, and rebuilds it with an inlined script.
 * @param {string} filePath
 * @returns {string}
 */
const processHtml = (filePath) => {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const calls = extractCalls(raw);
    const { content, lang } = strip(raw);
    return rebuild(content, lang, calls, { getHtmlSrc });
};

/**
 * Starts the dev server, processing .html files on request and serving other assets as-is.
 * @param {string} [dir='.'] - Root directory to serve files from.
 * @param {number} [port=3000]
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
                res.writeHead(500);
                return res.end(err.message);
            }
        }

        res.writeHead(200, { 'Content-Type': MIMES[ext] || 'text/plain' });
        fs.createReadStream(filePath).pipe(res);
    });

    server.listen(port, () => {
        console.log(`cygnus → http://localhost:${port}`);
    });
};

export { serve, processHtml };