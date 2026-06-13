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

## Syntax Reference

Beyond `using()` for files, Cygnus also supports the following.

### `name()`
auto-generate `<head>`

```html
name('My App', './favicon.ico');

<html lang="en">
<body>
    <h1>Hello</h1>
</body>
</html>
```

`name('My App');` = `<title>My App</title>`<br>
Generates `<meta charset>`, viewport, `<title>`, and `<link rel="icon">` automatically. The favicon argument is optional. If you write your own `<head>`, Cygnus won't override it.

### `*name.create()`

Declare a chunk of HTML as a named variable, reusable within the same file.

```html
*badge.create(<span class="badge">New</span>);

using('#item1', *badge);
using('#item2', *badge);
```

Variable names must be unique per file duplicates throw an error at build time.

### Cross-file variables

A component file can contain only a variable declaration.

```html
<!-- card.html -->
*card.create(<div class="card"><h3>Hello</h3></div>);
```

```html
<!-- index.html -->
using('#x', *card, 'card.html');
```

The third argument (file) is required when referencing a variable declared in another file.

### `using(CSS, ...)` - stylesheet injection

```html
using(CSS, 'dialog.css');
```

Injects `<link rel="stylesheet" href="dialog.css">` into `<head>`. If no `<head>` exists yet (no `name()`, no manual `<head>`), Cygnus creates an empty one.

### `toggle()` - runtime class toggle

```html
<button onclick="toggle('dialog')">Open</button>
```

```js
toggle('id')          // toggles class 'active' on #id (or .id)
toggle('id', 'open')  // toggles a custom class name
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
import { extractCalls, extractCssLinks, extractName, strip } from './cygnus/lib/parse.js';
import { extractVars, stripVars } from './cygnus/lib/vars.js';
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
        const hasVarDecl = /\*[A-Za-z_][A-Za-z0-9_]*\.create\(/.test(html);
        const calls = extractCalls(html);
        const cssLinks = extractCssLinks(html);
        const name = extractName(html);

        if (!calls.length && !name && !hasVarDecl && !cssLinks.length) {
            return html;
        }

        const { vars, ranges } = extractVars(html);
        const rawClean = stripVars(html, ranges);

        const { content, lang } = strip(rawClean);

        return rebuild(
            content,
            lang,
            calls,
            {
                getHtmlSrc,
                name,
                vars,
                cssLinks
            }
        );
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
.html file : Cygnus reads using() / name() / *var.create() calls
           : strips boilerplate
           : injects DOCTYPE + <head> + <link> (CSS) + script inline
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