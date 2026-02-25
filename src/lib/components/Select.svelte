<script lang="ts">
	let {
		value,
		options,
		onchange,
		disabled = false
	}: {
		value: string;
		options: { value: string; label: string }[];
		onchange: (value: string) => void;
		disabled?: boolean;
	} = $props();

	function handleChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		onchange(target.value);
	}
</script>

<div class="relative">
	<select
		value={value}
		disabled={disabled}
		onchange={handleChange}
		class="block w-full appearance-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 pr-10 text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
	>
		{#each options as option}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
	<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[var(--color-text-muted)]">
		<svg
			class="h-4 w-4"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M19 9l-7 7-7-7"
			></path>
		</svg>
	</div>
</div>
