<script lang="ts">
	let {
		checked,
		onchange,
		disabled = false
	}: {
		checked: boolean;
		onchange: (checked: boolean) => void;
		disabled?: boolean;
	} = $props();

	function handleToggle() {
		if (!disabled) {
			onchange(!checked);
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
			event.preventDefault();
			onchange(!checked);
		}
	}
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	disabled={disabled}
	onclick={handleToggle}
	onkeydown={handleKeyDown}
	class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
	class:bg-[var(--color-primary)]={checked}
	class:bg-[var(--color-border)]={!checked}
>
	<span
		class="inline-block h-4 w-4 transform rounded-full bg-[var(--color-surface)] shadow transition-transform duration-200 ease-in-out"
		class:translate-x-6={checked}
		class:translate-x-1={!checked}
	></span>
</button>
