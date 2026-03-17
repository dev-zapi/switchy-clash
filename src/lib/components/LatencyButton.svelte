<script lang="ts">
  let {
    delay = null,
    isTesting = false,
    failed = false,
    onTest = () => {},
    size = 'sm'
  }: {
    delay?: number | null;
    isTesting?: boolean;
    failed?: boolean;
    onTest?: () => void;
    size?: 'sm' | 'md';
  } = $props();

  function formatDelay(delay: number): string {
    if (delay <= 0) return '0ms';
    if (delay < 1000) return `${delay}ms`;
    return `${(delay / 1000).toFixed(2)}s`;
  }

  function getDelayColor(delay: number): string {
    if (delay <= 0) return 'text-[var(--color-text-muted)]';
    if (delay < 200) return 'text-green-500';
    if (delay < 500) return 'text-yellow-500';
    return 'text-red-500';
  }

  function getTitle(): string {
    if (isTesting) return 'Testing...';
    if (failed) return 'Failed - Click to retry';
    if (delay !== null && delay > 0) return 'Click to retest';
    return 'Test latency';
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 min-w-[50px]',
    md: 'text-sm px-3 py-1.5 min-w-[80px]'
  };
</script>

<button
  onclick={(e) => {
    e.stopPropagation();
    onTest();
  }}
  disabled={isTesting}
  class="{sizeClasses[size]} rounded text-center transition-colors border border-transparent {
    isTesting
      ? 'text-[var(--color-text-muted)]'
      : failed
        ? 'text-red-500 hover:bg-red-500/10 border-red-200'
        : delay !== null && delay > 0
          ? getDelayColor(delay) + ' font-medium hover:bg-[var(--color-bg-tertiary)] border-[var(--color-border)]'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg-tertiary)]'
  }"
  title={getTitle()}
>
  {#if isTesting}
    <span class="animate-spin">⏳</span>
  {:else if failed}
    ❌
  {:else if delay !== null && delay > 0}
    {formatDelay(delay)}
  {:else}
    ⚡
  {/if}
</button>