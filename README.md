<p align="center">
    <img src='./assets/logo.png' alt='Logo' width='380'>
</p>

<h3 align='center'>A lightweight HTML preprocessor<br>For native '.html' component files.</h3> 
<br>

<img src='./assets/cygnus.png' alt='Logo'><br>

## Get Started

**1. Clone and install**
```bash
git clone https://github.com/Peakk2011/cygnus.git
cd cygnus
npm install
```

**2. Create your first page**

Create `src/index.html`:
```html
@name('My App')

<html lang="en">
<body>
    <h1>Hello Cygnus</h1>
</body>
</html>
```

**3. Run**
```bash
npm run dev
```

That's it.

## Syntax Reference

### `@name()` : auto-generate `<head>`
```html
@name('My App', './favicon.ico')
```

### `@using` : inject component
```html
@using "#nav" from "./components/nav.html"
```

### `@using CSS` : inject stylesheet
```html
@using CSS "dialog.css"
```

### `*name.create()` : reusable variable
```html
*badge.create(<span class="badge">New</span>)

@using "#item1" from *badge
@using "#item2" from *badge
```

### Cross-file variable
```html
<!-- card.html -->
*card.create(<div class="card"><h3>Hello</h3></div>)
```
```html
<!-- index.html -->
@using "#x" from *card in "card.html"
```

### `toggle()` : runtime class toggle
```html
<button onclick="toggle('dialog')">Open</button>
```

## License
MIT [LICENSE.md](./LICENSE.md)
