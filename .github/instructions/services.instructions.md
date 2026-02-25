---
applyTo: "src/lib/services/**/*.ts"
---

## Service Layer Guidelines

Services in `src/lib/services/` wrap external APIs and Chrome extension APIs.

### Clash API Service (`clash-api.ts`)

- All API methods are async and return typed responses
- Use `fetch` for HTTP requests to the Clash API
- Always encode proxy/group names with `encodeURIComponent()` in URL paths
- Include `Authorization: Bearer {secret}` header when secret is configured
- API reference is in `docs/API.md`

### Storage Service (`storage.ts`)

- Wraps `chrome.storage.local` with typed getters/setters
- Always handle missing keys by falling back to defaults from `DEFAULT_STORAGE`
- Use `chrome.storage.onChanged` listener for cross-page synchronization
- The storage service is a singleton instance exported as `storage`

### Proxy Service (`proxy.ts`)

- Wraps `chrome.proxy.settings.set()` and `chrome.proxy.settings.get()`
- Always check `chrome.runtime.lastError` in callbacks
- Port priority: `mixed-port` > `port` > `socks-port` (default 7890)
- Bypass list defaults are in `DEFAULT_BYPASS_LIST` from types

### General Rules

- All Chrome API calls must handle `chrome.runtime.lastError`
- Use Promise wrappers around Chrome callback-style APIs
- Export types alongside service classes
- Services should be stateless when possible (except storage singleton)
