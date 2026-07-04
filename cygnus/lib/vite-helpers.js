// @fileoverview Vite integration helpers for Cygnus.
// Extracts the pipeline glue (safeResolve, processCygnusHtml, copyDirWithHtml,
// plugin factory) so that consumer projects can build their own vite.config.js
// without re-implementing the same code.

import { readFileSync, writeFileSync, copyFileSync, mkdirSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { extractCalls, extractCssLinks, extractName, strip } from './parse.js';
import { extractVars, stripVars } from './vars.js';
import { rebuild } from './inject.js';
import { buildErrorOverlay } from './error-overlay.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the getHTML.js source and inline it within the script tag.
const getHtmlSrc = readFileSync(
    path.join(__dirname, 'getHTML.js'),
    'utf-8'
);

// Detect any Cygnus directive or variable declaration.
// Covers: @using, @name, using(), name(), *name.create(), *name = value
export const HAS_DECL_RE = /(?:@using|@name\s*\(|using\s*\(|name\s*\(|\*[\p{L}_][\p{L}\p{M}\p{N}_]*(\.create\(|\s*=\s*))/u;

/**
 * Resolve a path requested relative to `baseDir` and guarantee the result
 * stays inside `rootDir`. Throws on any "../" (or absolute-path) escape
 * attempt, preventing path-traversal reads of files outside the project.
 */
export const safeResolve = (baseDir, requestPath, rootDir) => {
    const abs = path.resolve(baseDir, requestPath);
    const rel = path.relative(rootDir, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new Error(`cygnus: refused to access "${requestPath}" — outside of project root`);
    }
    return abs;
};

/**
 * Process a raw HTML string through the full Cygnus pipeline.
 * Returns processed HTML, or an error overlay page if the pipeline throws.
 */
export const processCygnusHtml = (html, opts = {}) => {
    try {
        const hasDecl = HAS_DECL_RE.test(html);
        const calls = extractCalls(html);
        const cssLinks = extractCssLinks(html);
        const name = extractName(html);

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
            rootDir: opts.rootDir || process.cwd(),
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
 */
export const copyDirWithHtml = (src, dest, isBuild) => {
    mkdirSync(dest, { recursive: true });
    const entries = readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirWithHtml(srcPath, destPath, isBuild);
            continue;
        }

        if (entry.name.endsWith('.html')) {
            const raw = readFileSync(srcPath, 'utf-8');
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

/**
 * Build the Vite plugin instance. Factory takes optional options and returns
 * a Vite plugin object. Call as: cygnusPlugin({ srcRoot: 'src' })
 */
export const cygnusPlugin = (opts = {}) => {
    const srcRootRel = opts.srcRoot || 'src';
    const silent = opts.silent || false;

    const collectedCss = new Set();
    const collectedDirs = new Set();
    let rootDir;
    let resolvedOutDir;

    /**
     * Scan and collect all top-level directories in rootDir,
     * excluding common ignored ones.
     */
    const collectAllDirs = (dir) => {
        try {
            const entries = readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const dirName = entry.name;
                    if (!['node_modules', '.git', 'dist', 'build', '.vite'].includes(dirName)) {
                        collectedDirs.add(path.join(dir, dirName));
                    }
                }
            }
        } catch (err) {
            console.warn(`cygnus: could not scan directories in ${dir}`);
        }
    };

    return {
        name: 'vite-plugin-cygnus',

        /**
         * Capture the fully resolved Vite config, so we read the real
         * outDir instead of assuming it's always "dist".
         */
        configResolved(config) {
            resolvedOutDir = path.isAbsolute(config.build.outDir)
                ? config.build.outDir
                : path.resolve(config.root, config.build.outDir);
        },

        /**
         * Load to serve .html files as raw text in dev mode.
         */
        load(id) {
            if (!id.endsWith('.html')) return null;

            try {
                const raw = readFileSync(id, 'utf-8');
                return raw;
            } catch (err) {
                return null;
            }
        },

        /**
         * Make dev server to serve non-index .html files as raw text.
         * SECURITY: req.url is untrusted client input. It is decoded and
         * resolved against srcRoot, then verified with safeResolve().
         */
        configureServer(server) {
            return () => {
                server.middlewares.use((req, res, next) => {
                    const isHtmlFile = req.url.endsWith('.html') &&
                        req.url !== '/' &&
                        req.url !== '/index.html' &&
                        !req.url.startsWith('/@');
                    if (!isHtmlFile) return next();

                    let filePath;
                    try {
                        const decodedUrl = decodeURIComponent(req.url.split('?')[0]);
                        const projectRoot = server.config?.root
                            ? path.resolve(server.config.root)
                            : process.cwd();
                        const baseDir = path.isAbsolute(srcRootRel)
                            ? srcRootRel
                            : path.resolve(projectRoot, srcRootRel);
                        filePath = safeResolve(baseDir, `.${decodedUrl}`, baseDir);
                    } catch (err) {
                        res.statusCode = 403;
                        res.end('Forbidden');
                        return;
                    }

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
            rootDir = path.resolve(fileDir, srcRootRel); // assign to outer-scope var

            if (isBuild) {
                for (const css of extractCssLinks(html)) {
                    collectedCss.add(safeResolve(fileDir, css, rootDir));
                }
                collectAllDirs(rootDir);
            }

            return processCygnusHtml(html, { isBuild, fileDir, rootDir });
        },

        /**
         * After the bundle is written:
         * - Copy individual CSS files that were referenced in the entry HTML
         * - Walk every collected folder and copy it to dist,
         *   processing any .html files through Cygnus along the way
         */
        closeBundle() {
            const outDir = resolvedOutDir || path.resolve(process.cwd(), 'dist');

            for (const absCss of collectedCss) {
                const rel = path.relative(rootDir, absCss);
                const dest = path.join(outDir, rel);
                mkdirSync(path.dirname(dest), { recursive: true });
                copyFileSync(absCss, dest);
                if (!silent) console.log(`cygnus: copied  ${rel} → dist/${rel}`);
            }

            for (const srcDir of collectedDirs) {
                const rel = path.relative(process.cwd(), srcDir);
                const destDir = path.join(outDir, rel);
                copyDirWithHtml(srcDir, destDir, true);
                if (!silent) console.log(`cygnus: copied folder ${rel} → dist/${rel}`);
            }
        }
    };
};