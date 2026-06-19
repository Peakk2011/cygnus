import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, readdirSync } from 'fs';
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

/*
    Detect any Cygnus directive or variable declaration.
    Covers: @using, @name, using(), name(), *name.create(), *name = value
*/
const HAS_DECL_RE = /(?:@using|@name\s*\(|using\s*\(|name\s*\(|\*[\p{L}_][\p{L}\p{M}\p{N}_]*(\.create\(|\s*=\s*))/u;

/**
 * Process a raw HTML string through the full Cygnus pipeline.
 * Shared between transformIndexHtml and the closeBundle folder walk.
 *
 * @param {string} html - Raw HTML source
 * @param {Object} opts - Extra options forwarded to rebuild (e.g. isBuild, fileDir)
 * @returns {string} Processed HTML, or an error overlay page if the pipeline throws
 */
const processCygnusHtml = (html, opts = {}) => {
    try {
        const hasDecl  = HAS_DECL_RE.test(html);
        const calls    = extractCalls(html);
        const cssLinks = extractCssLinks(html);
        const name     = extractName(html);

        // Nothing to do — return original HTML untouched
        if (!calls.length && !name && !hasDecl && !cssLinks.length) {
            return html;
        }

        const { vars, ranges } = extractVars(html);
        const rawClean = stripVars(html, ranges);
        const { content, lang } = strip(rawClean);

        return rebuild(content, lang, calls, {
            getHtmlSrc,
            name,
            vars,
            cssLinks,
            ...opts
        });
    } catch (err) {
        return buildErrorOverlay(err);
    }
};

/**
 * Recursively copy a directory from src to dest.
 * .html files are processed through Cygnus before being written.
 * All other files are copied as-is.
 *
 * @param {string} src - Absolute source directory path
 * @param {string} dest - Absolute destination directory path
 * @param {boolean} isBuild - Whether we are in a production build
 */
const copyDirWithHtml = (src, dest, isBuild) => {
    mkdirSync(dest, { recursive: true });

    const entries = readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath  = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirWithHtml(srcPath, destPath, isBuild);
            continue;
        }

        if (entry.name.endsWith('.html')) {
            // Run Cygnus pipeline on every .html file found inside the folder
            const raw       = readFileSync(srcPath, 'utf-8');
            const processed = processCygnusHtml(raw, {
                isBuild,
                fileDir: src
            });

            writeFileSync(destPath, processed, 'utf-8');
            console.log(`cygnus: processed  ${path.relative(process.cwd(), srcPath)}`);
        } else {
            copyFileSync(srcPath, destPath);
        }
    }
};

const cygnusPlugin = () => {
    const collectedCss  = new Set();
    const collectedDirs = new Set();

    /**
     * Scan and collect all top-level directories in rootDir,
     * excluding common ignored ones.
     * @param {string} rootDir
     */
    const collectAllDirs = (rootDir) => {
        try {
            const entries = readdirSync(rootDir, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const dirName = entry.name;

                    if (!['node_modules', '.git', 'dist', 'build', '.vite'].includes(dirName)) {
                        collectedDirs.add(path.join(rootDir, dirName));
                    }
                }
            }
        } catch (err) {
            console.warn(`cygnus: could not scan directories in ${rootDir}`);
        }
    };

    return {
        name: 'vite-plugin-cygnus',

        /**
         * Load to serve .html files as raw text in dev mode.
         * *varName.create(...) patterns for browser-side extract
         */
        load(id) {
            // Only intercept .html file loads in the src directory
            if (!id.endsWith('.html')) return null;
            if (!id.includes(path.resolve(__dirname, 'src'))) return null;

            try {
                const raw = readFileSync(id, 'utf-8');
                // Return as plain text module so browser can fetch it
                return raw;
            } catch (err) {
                return null;
            }
        },

        /**
         * Make dev server to serve non-index .html files as raw text.
         * *varName.create(...) patterns for browser-side extractCreate().
         */
        configureServer(server) {
            return () => {
                server.middlewares.use((req, res, next) => {
                    // Match xxx.html, etc. but not /index.html or root '/'
                    const isHtmlFile = req.url.endsWith('.html') && 
                                      req.url !== '/' && 
                                      req.url !== '/index.html' && 
                                      !req.url.startsWith('/@');

                    if (!isHtmlFile) return next();

                    const srcRoot = path.resolve(__dirname, 'src');
                    const filePath = path.join(srcRoot, req.url);

                    try {
                        const raw = readFileSync(filePath, 'utf-8');
                        res.setHeader('Content-Type', 'text/html;charset=UTF-8');
                        res.end(raw);
                    } catch (err) {
                        next();
                    }
                });
            };
        },

        /**
         * Transform the Vite entry point index.html through the Cygnus pipeline.
         * Also collects CSS paths and folder names during a production build.
         */
        transformIndexHtml(html, ctx) {
            const isBuild = ctx.server === undefined;
            const fileDir = path.dirname(ctx.filename);

            if (isBuild) {
                // Collect CSS files referenced in the entry HTML
                for (const css of extractCssLinks(html)) {
                    collectedCss.add(path.resolve(fileDir, css));
                }

                // Collect ALL top-level folders from the source root
                const srcRoot = path.resolve(__dirname, 'src');
                collectAllDirs(srcRoot);
            }

            return processCygnusHtml(html, { isBuild, fileDir });
        },

        /**
         * After the bundle is written:
         * - Copy individual CSS files that were referenced in the entry HTML
         * - Walk every collected folder and copy it to dist,
         *   processing any .html files through Cygnus along the way
         */
        closeBundle() {
            const outDir  = path.resolve(__dirname, 'dist');
            const srcRoot = path.resolve(__dirname, 'src');

            // Copy individual CSS files
            for (const absCss of collectedCss) {
                const rel  = path.relative(srcRoot, absCss);
                const dest = path.join(outDir, rel);

                mkdirSync(path.dirname(dest), { recursive: true });
                copyFileSync(absCss, dest);
                console.log(`cygnus: copied  ${rel} → dist/${rel}`);
            }

            // Copy all detected folders, processing .html files on the way
            for (const srcDir of collectedDirs) {
                const rel     = path.relative(srcRoot, srcDir);
                const destDir = path.join(outDir, rel);

                copyDirWithHtml(srcDir, destDir, true);
                console.log(`cygnus: copied folder ${rel} → dist/${rel}`);
            }
        }
    };
};

export default defineConfig({
    root: 'src',
    build: {
        outDir: '../../dist',
        emptyOutDir: true
    },
    server: {
        fs: {
            strict: false
        }
    },
    plugins: [cygnusPlugin()]
});