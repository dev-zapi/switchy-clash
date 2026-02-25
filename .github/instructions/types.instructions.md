---
applyTo: "src/lib/types/**/*.ts"
---

## Type Definition Guidelines

Type definitions in `src/lib/types/` define the data contracts for the entire extension.

### Organization

- `clash.ts` - Types matching the Clash (mihomo) API responses (see `docs/API.md`)
- `storage.ts` - Types for Chrome extension storage (configs, settings, state)
- `index.ts` - Re-exports from all type files

### Conventions

- Use `interface` for object shapes, `type` for unions and computed types
- Export all types; they are consumed by services, components, and the background worker
- Keep default values as exported constants (e.g., `DEFAULT_BYPASS_LIST`, `DEFAULT_CONFIG`, `DEFAULT_STORAGE`)
- Match Clash API field names exactly (including hyphens like `mixed-port`, `socks-port`)
- Config status is a union: `'unknown' | 'available' | 'unavailable'`
- Theme mode is a union: `'light' | 'dark' | 'system'`
