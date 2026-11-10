# app-base

A starter template for cross-platform desktop apps built with Tauri 2, React and TypeScript. It ships with a schema-driven settings page, so every new app starts with working settings instead of a blank slate.

## Features

- Tauri 2 + React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Schema-driven settings: define fields in one file and the page renders itself (toggle, text, number, select, path)
- Persistent settings with validation (zod) and versioned migrations
- i18n with i18next (pt-BR and en)
- Light, dark and system theme
- Custom title bar (native window controls on macOS)
- Tray icon and launch at startup

## Prerequisites

Node.js, Rust and the [Tauri system dependencies](https://v2.tauri.app/start/prerequisites/).

## Getting started

```bash
gh repo create my-app --template gpires-codes/app-base --private --clone
cd my-app
npm install
npm run tauri dev
```

Or click **Use this template** on GitHub.

## Make it yours

1. Rename:
   - `name` in `package.json` and `src-tauri/Cargo.toml`
   - `productName`, `identifier` and the window `title` in `src-tauri/tauri.conf.json` and `src-tauri/tauri.macos.conf.json`
   - `<title>` in `index.html`
2. Replace `LICENSE` if your app is not MIT.
3. Add your settings in `src/app/settings.schema.ts` and their translations in `src/locales/`.

## Project structure

```
src/
├─ core/      shared code, identical in every app
├─ app/       per-app config (settings schema)
└─ locales/   translations
```

`core/` never imports from `app/`, so it stays reusable.

## License

[MIT](LICENSE)
