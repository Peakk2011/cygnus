import { defineConfig } from 'vite';
import { cygnusPlugin } from './cygnus/lib/vite-helpers.js';

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