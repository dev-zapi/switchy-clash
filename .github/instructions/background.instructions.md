---
applyTo: "src/background/**/*.ts"
---

## Background Service Worker Guidelines

The background script (`src/background/index.ts`) runs as a Chrome Extension Manifest V3 service worker.

### Message Handling

- All communication from popup/options goes through `chrome.runtime.sendMessage`
- The background listener must return `true` to keep the message channel open for async responses
- Supported message types: `ENABLE_PROXY`, `DISABLE_PROXY`, `TOGGLE_PROXY`, `CHECK_ALL_CONFIGS`, `GET_STATE`, `SWITCH_CONFIG`
- Always wrap handler logic in try/catch and return `{ success, data?, error? }`

### Service Worker Constraints

- No DOM access (no `document`, no `window`)
- No ES module dynamic imports at runtime
- Service worker may be terminated and restarted by Chrome at any time
- Use `chrome.storage.local` for persistent state, NOT in-memory variables
- Register event listeners at the top level (not inside async functions)

### Icon Management

- Update icon via `chrome.action.setIcon()` when proxy state changes
- Icon files: `icons/icon-on-{size}.png` and `icons/icon-off-{size}.png` (16/32/48/128)
- Use `chrome.action.setBadgeText()` for error indicators

### Auto-Switch Logic

- On startup: check configs in priority order (last used > default > first available)
- Health check uses `GET /version` with 3s timeout
- If active config fails, try next available config
- If no configs available and proxy was enabled, disable proxy
