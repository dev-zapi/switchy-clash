---
applyTo: "src/**/*.svelte"
---

## Svelte Component Guidelines

All Svelte components MUST use **Svelte 5 runes mode**. Never use Svelte 4 syntax.

### Required Patterns

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  // Props - use $props(), NOT export let
  let { prop1, prop2 = 'default', children }: {
    prop1: string;
    prop2?: string;
    children?: Snippet;
  } = $props();

  // Reactive state - use $state(), NOT let with $:
  let count = $state(0);

  // Computed values - use $derived(), NOT $: labels
  let doubled = $derived(count * 2);

  // Side effects - use $effect(), NOT $: blocks
  $effect(() => {
    console.log(count);
  });
</script>

<!-- Content projection - use {#snippet}/{@render}, NOT <slot> -->
{@render children?.()}
```

### Forbidden Patterns (Svelte 4 - DO NOT USE)

- `export let prop` -> use `$props()`
- `$: value = ...` -> use `$derived()`
- `$: { sideEffect() }` -> use `$effect()`
- `<slot />` -> use `{#snippet}` / `{@render}`
- `$$props` / `$$restProps` -> destructure from `$props()`

### Styling

- Use Tailwind CSS 4 utility classes directly in templates
- Use CSS custom properties for theme colors: `var(--color-bg)`, `var(--color-text)`, `var(--color-primary)`, etc.
- All components must support both light and dark themes via the CSS custom properties
- Avoid inline `<style>` blocks; prefer Tailwind classes

### Component Structure

- Always include `<script lang="ts">` (TypeScript required)
- Import types from `$lib/types`
- Import services from `$lib/services`
- Import shared components from `$lib/components`
