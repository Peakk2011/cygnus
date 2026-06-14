import { defineConfig } from 'vite';
import { readFileSync, copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { extractCalls, extractCssLinks, extractName, strip } from './cygnus/lib/parse.js';
import { extractVars, stripVars } from './cygnus/lib/vars.js';
import { rebuild } from './cygnus/lib/inject.js';
import { buildErrorOverlay } from './cygnus/lib/error-overlay.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const getHtmlSrc = readFileSync(
    path.join(__dirname, 'cygnus/lib/getHTML.js'),
    'utf-8'
);

const HAS_DECL_RE = /(?:@using|@name\s*\(|\*[\p{L}_][\p{L}\p{M}\p{N}_]*(\.create\(|\s*=\s*))/u;

const cygnusPlugin = () => {
    const collectedCss = new Set();
    const collectedDirs = new Set();

    // Recursive copy function
    const copyDir = (src, dest) => {
        mkdirSync(dest, { recursive: true });
        const entries = readdirSync(src, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                copyDir(srcPath, destPath);
            } else {
                copyFileSync(srcPath, destPath);
            }
        }
    };

    // Scan and collect all top-level directories (excluding common ignored ones)
    const collectAllDirs = (rootDir) => {
        try {
            const entries = readdirSync(rootDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const dirName = entry.name;
                    // Skip common ignored directories
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

        transformIndexHtml(html, ctx) {
            try {
                const isBuild = ctx.server === undefined;
                const fileDir = path.dirname(ctx.filename);

                const hasDecl = HAS_DECL_RE.test(html);
                const calls = extractCalls(html);
                const cssLinks = extractCssLinks(html);
                const name = extractName(html);

                if (!calls.length && !name && !hasDecl && !cssLinks.length) {
                    return html;
                }

                if (isBuild) {
                    // Collect CSS files
                    for (const css of cssLinks) {
                        collectedCss.add(path.resolve(fileDir, css));
                    }

                    // Collect ALL top-level folders from source root
                    const srcRoot = path.resolve(__dirname, 'src/test');
                    collectAllDirs(srcRoot);
                }

                const { vars, ranges } = extractVars(html);
                const rawClean = stripVars(html, ranges);
                const { content, lang } = strip(rawClean);

                return rebuild(content, lang, calls, {
                    getHtmlSrc,
                    name,
                    vars,
                    cssLinks,
                    isBuild,
                    fileDir
                });
            } catch (err) {
                return buildErrorOverlay(err);
            }
        },

        closeBundle() {
            const outDir = path.resolve(__dirname, 'dist');
            const srcRoot = path.resolve(__dirname, 'src/test');

            // Copy individual CSS files
            if (collectedCss.size) {
                for (const absCss of collectedCss) {
                    const rel = path.relative(srcRoot, absCss);
                    const dest = path.join(outDir, rel);

                    mkdirSync(path.dirname(dest), { recursive: true });
                    copyFileSync(absCss, dest);
                    console.log(`cygnus: copied  ${rel} → dist/${rel}`);
                }
            }

            // Copy all detected folders
            if (collectedDirs.size) {
                for (const srcDir of collectedDirs) {
                    const rel = path.relative(srcRoot, srcDir);
                    const destDir = path.join(outDir, rel);

                    copyDir(srcDir, destDir);
                    console.log(`cygnus: copied folder ${rel} → dist/${rel}`);
                }
            }
        }
    };
};

export default defineConfig({
    root: 'src/test',
    build: {
        outDir: '../../dist',
        emptyOutDir: true
    },
    plugins: [cygnusPlugin()]
});