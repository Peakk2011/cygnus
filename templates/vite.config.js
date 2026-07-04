import { defineConfig } from 'vite';
import { cygnusPlugin } from '@peakk/cygnus';

// This is a minimal example of vite.config.js for a Cygnus project.
// Copy this file to the root of your project, then run `npm run dev`.
//
// What it does:
// - Tells Vite to serve files from ./src
// - Registers the cygnusPlugin() to preprocess .html files
// - Disables Vite's strict fs check so it can serve files outside the root
//   (needed when cygnus references sibling folders via @using directives)

export default defineConfig({
    root: 'src',
    build: {
        outDir: '../dist',
        emptyOutDir: true
    },
    server: {
        fs: {
            strict: false
        }
    },
    plugins: [cygnusPlugin()]
});
