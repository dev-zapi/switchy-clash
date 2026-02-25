<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		variant = 'info',
		children
	}: {
		variant?: 'success' | 'warning' | 'danger' | 'info' | 'muted';
		children?: Snippet;
	} = $props();

	const variantStyles = {
		success: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
		warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
		danger: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
		info: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
		muted: 'bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]'
	};
</script>

<span
	class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {variantStyles[variant]}"
>
	{#if children}
		{@render children()}
	{/if}
</span>
