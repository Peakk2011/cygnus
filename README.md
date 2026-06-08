<img src='./assets/logo.png' alt='Logo' width='380'><br>

# Cygnus

> A tool that can make a native '.html' module components.

## What is Cygnus?

Cygnus is a lightweight HTML preprocessor that lets you split your UI into native `.html` component files<br>
Note: Cygnus going no framework, no virtual DOM and no overhead
<br>
Write `using()` at the top of your HTML. Cygnus handles the rest.

## Usage (Example) 

It's not a real working example code, but if you want it to run, create a folder called `components` followed by a name like `nav`, `footer`, and then the `.html` extension.

```html
using('#nav', './components/nav.html');
using('#footer', './components/footer.html');

<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My App</title>
</head>
<body>
    <div id="nav"></div>
    <div id="footer"></div>
</body>
</html>
```

## Installation

Before installing, you need to ensure that this repository is already installed and cloned, so you can run and install the process below.

```bash
npm install -D cygnus
```

## Running

### Standalone dev server
```bash
cygnus ./src 3000
```

### With Vite

Create `vite.config.js` and copy this and paste into it.

```js
import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { extractCalls, strip } from './cygnus/lib/parse.js';
import { rebuild } from './cygnus/lib/inject.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
```

Run this project

```bash
npm run dev
```

## How it works (Flow)

```
.html file : Cygnus reads using() calls
           : strips boilerplate
           : injects DOCTYPE + script inline
           : browser receives complete HTML
```

## File Structure

```
your-project/
├── cygnus/
├── src/
│   ├── index.html
│   └── components/
│       ├── nav.html
│       └── footer.html
├── vite.config.js
└── package.json
```

## License

MIT <a href='./LICENSE.md'>Go to LICENSE.md</a>