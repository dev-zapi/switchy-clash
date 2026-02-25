<script lang="ts">
	let {
		status
	}: {
		status: 'available' | 'unavailable' | 'unknown';
	} = $props();

	const statusColors = {
		available: 'bg-[var(--color-success)]',
		unavailable: 'bg-[var(--color-danger)]',
		unknown: 'bg-[var(--color-text-muted)]'
	};
</script>

<span
	class="inline-block h-2.5 w-2.5 rounded-full {statusColors[status]}"
	aria-label="Status: {status}"
	title="Status: {status}"
></span>
