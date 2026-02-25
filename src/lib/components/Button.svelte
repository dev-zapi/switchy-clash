<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		variant = 'primary',
		size = 'md',
		disabled = false,
		loading = false,
		onclick,
		children
	}: {
		variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
		size?: 'sm' | 'md';
		disabled?: boolean;
		loading?: boolean;
		onclick?: () => void;
		children?: Snippet;
	} = $props();

	const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

	const variantStyles = {
		primary: 'bg-[var(--color-primary)] text-[var(--color-surface)] hover:bg-[var(--color-primary-hover)] focus:ring-[var(--color-primary)]',
		secondary: 'bg-[var(--color-surface-elevated)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface)] focus:ring-[var(--color-border)]',
		danger: 'bg-[var(--color-danger)] text-[var(--color-surface)] hover:bg-[var(--color-danger-hover)] focus:ring-[var(--color-danger)]',
		ghost: 'bg-transparent text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)] focus:ring-[var(--color-border)]'
	};

	const sizeStyles = {
		sm: 'px-3 py-1.5 text-sm',
		md: 'px-4 py-2 text-base'
	};
</script>

<button
	type="button"
	disabled={disabled || loading}
	onclick={onclick}
	class="{baseStyles} {variantStyles[variant]} {sizeStyles[size]}"
>
	{#if loading}
		<svg
			class="animate-spin -ml-1 mr-2 h-4 w-4"
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
		>
			<circle
				class="opacity-25"
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				stroke-width="4"
			></circle>
			<path
				class="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			></path>
		</svg>
	{/if}
	{#if children}
		{@render children()}
	{/if}
</button>
