# Switchy Clash - Copilot Instructions

This is a Chrome Extension (Manifest V3) for viewing and controlling Clash proxy configuration via API. Built with Svelte 5, Vite 6, TypeScript 5, and Tailwind CSS 4.

## Project Structure

```
src/
├── background/index.ts          # Chrome extension service worker
├── popup/                       # Popup UI (shown when clicking extension icon)
│   ├── App.svelte
│   ├── index.html
│   └── main.ts
├── options/                     # Extension settings page (chrome://extensions)
│   ├── App.svelte
│   ├── index.html
│   └── main.ts
├── lib/
│   ├── services/
│   │   ├── clash-api.ts         # Clash REST API client
│   │   ├── proxy.ts             # Chrome proxy API wrapper
│   │   └── storage.ts           # Chrome storage API wrapper
│   ├── types/                   # TypeScript type definitions
│   ├── components/              # Shared Svelte 5 components
│   └── utils.ts                 # Utility functions (theme, formatting)
├── icons/                       # Source SVG icons
└── app.css                      # Global styles + CSS custom properties
public/
├── manifest.json                # Chrome Extension Manifest V3
└── icons/                       # Generated PNG icons (16/32/48/128)
docs/
├── REQUIREMENTS.md              # Feature requirements specification
├── API.md                       # Clash (mihomo) API reference
└── CHROME_PROXY_API.md          # Chrome proxy API reference
```

## Build & Development

- **Install**: `npm install`
- **Build**: `npm run build` (outputs to `dist/`)
- **Type check**: `npm run check` (runs svelte-check)
- **Dev**: `npm run dev` (Vite dev server, limited use for extensions)
- **Load extension**: Load `dist/` folder as unpacked extension in `chrome://extensions`

## Code Standards

### Svelte 5 Runes (MANDATORY)

This project uses **Svelte 5 with runes mode**. Never use Svelte 4 syntax.

- Use `$state()` for reactive state, NOT `let x` with `$:` reactivity
- Use `$derived()` / `$derived.by()` for computed values, NOT `$:` labels
- Use `$effect()` for side effects, NOT `$:` blocks
- Use `$props()` for component props, NOT `export let`
- Use `{#snippet}` / `{@render}` for content projection, NOT `<slot>`

### TypeScript

- All files use TypeScript (`.ts`, `.svelte` with `<script lang="ts">`)
- Types are defined in `src/lib/types/`
- Use strict typing; avoid `any` unless interfacing with Chrome APIs

### Tailwind CSS 4

- Use Tailwind utility classes in Svelte templates
- Theme colors use CSS custom properties: `var(--color-bg)`, `var(--color-text)`, `var(--color-primary)`, etc.
- Dark mode is applied via `.dark` class on `<html>` element
- Custom properties are defined in `src/app.css`

### Chrome Extension Patterns

- Background service worker communicates via `chrome.runtime.sendMessage` / `onMessage`
- Storage uses `chrome.storage.local` (wrapped in `src/lib/services/storage.ts`)
- Proxy settings use `chrome.proxy.settings` (wrapped in `src/lib/services/proxy.ts`)
- All Chrome API calls should handle `chrome.runtime.lastError`
- Asset paths must be relative (Vite `base: ''` config) for extension compatibility

### Import Aliases

- `$lib/*` maps to `src/lib/*`
- Example: `import { ClashAPI } from '$lib/services/clash-api'`

## Key APIs

### Clash API (mihomo)

The extension communicates with a local Clash proxy instance. Key endpoints:
- `GET /version` - Health check and version info
- `GET /configs` - Get proxy port and mode
- `GET /proxies` - List all proxy groups and nodes
- `PUT /proxies/{name}` - Switch proxy node
- `GET /proxies/{name}/delay` - Test node latency
- `GET /group/{name}/delay` - Test group latency
- `GET /connections` - Active connections (for rule match display)

See `docs/API.md` for full reference.

### Chrome Proxy API

- `chrome.proxy.settings.set()` with `fixed_servers` mode to enable Clash proxy
- `chrome.proxy.settings.set()` with `system` mode to disable
- See `docs/CHROME_PROXY_API.md` for details

## Multiple Configurations

The extension supports multiple Clash API configurations (different hosts/ports/secrets). The data structure is `ExtensionConfig` in `src/lib/types/storage.ts`. Auto-switch logic runs on startup in the background worker.

## Architecture Decisions

- **No SSR**: This is a Chrome extension; all rendering is client-side
- **No router**: Popup and options are separate HTML entry points
- **Message passing**: Popup/options communicate with background via `chrome.runtime.sendMessage`
- **State sync**: Theme and proxy state sync between popup/options via `chrome.storage.onChanged`
