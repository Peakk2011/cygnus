# Cygnus Project Starter

This folder contains the minimum files you need to start a Cygnus project.

## Setup

```bash
# 1. Create a new project
mkdir my-app && cd my-app
npm init -y

# 2. Install Cygnus and Vite
npm install @peakk/cygnus
npm install -D vite

# 3. Copy the template files
mkdir src
cp /path/to/@peakk/cygnus/templates/vite.config.js ./
cp /path/to/@peakk/cygnus/templates/index.html ./src/

# 4. Add scripts to your package.json
#    (or use the "scripts" from a fresh `npm init -y` and edit them)
```

## package.json scripts

Add this to the `scripts` section of your `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

## Run

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`) and you should see "Hello Cygnus".

## Files

- `vite.config.js` — registers `cygnusPlugin()` with Vite
- `index.html` — a minimal Cygnus page using `@name()`

## Next steps

See the main `@peakk/cygnus` README for the full syntax reference:
- `@name()` — auto-generate `<head>`
- `@using` — inject components
- `@using CSS` — inject stylesheets
- `*name.create()` — reusable HTML variables
- `toggle()` — runtime class toggling
