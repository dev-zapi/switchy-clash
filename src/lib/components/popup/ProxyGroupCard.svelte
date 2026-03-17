<script lang="ts">
  import type { ProxyGroup } from '$lib/types';

  let {
    group,
    currentNodeName,
    currentNodeLatency,
    nodeCount,
    isTesting,
    failedTest,
    groupLatency,
    onTestLatency = () => {},
    onToggleExpanded = () => {}
  }: {
    group: ProxyGroup;
    currentNodeName: string;
    currentNodeLatency: number | null;
    nodeCount: { available: number; total: number };
    isTesting: boolean;
    failedTest: boolean;
    groupLatency?: number | null;
    onTestLatency?: () => void;
    onToggleExpanded?: () => void;
  } = $props();

  function getDelayColor(delay: number): string {
    if (delay <= 0) return 'text-[var(--color-text-muted)]';
    if (delay < 200) return 'text-green-500';
    if (delay < 500) return 'text-yellow-500';
    return 'text-red-500';
  }

  function formatDelay(delay: number): string {
    if (delay <= 0) return '0ms';
    if (delay < 1000) return `${delay}ms`;
    return `${(delay / 1000).toFixed(2)}s`;
  }

  function formatGroupLatency(latency: number | null): string {
    if (latency === null || latency <= 0) return '';
    if (latency < 1000) return `${Math.round(latency)}ms`;
    return `${(latency / 1000).toFixed(2)}s`;
  }

  function getGroupTypeLabel(type: string): string {
    switch (type) {
      case 'Selector': return 'Selector';
      case 'URLTest': return 'URLTest';
      case 'Fallback': return 'Fallback';
      case 'LoadBalance': return 'LoadBalance';
      case 'Relay': return 'Relay';
      default: return type;
    }
  }
</script>

<div class="relative bg-[var(--color-bg-secondary)] rounded-md px-3 py-2.5 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex items-center gap-3">
  <div
    onclick={onToggleExpanded}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') onToggleExpanded();
    }}
    role="button"
    tabindex="0"
    class="flex-1 min-w-0 flex items-center gap-3"
  >
    <div class="flex-1 min-w-0">
      <div class="text-sm font-semibold text-[var(--color-text)] truncate">
        {group.name}
      </div>
      
      <div class="text-xs text-[var(--color-text-secondary)] flex items-center gap-1">
        {getGroupTypeLabel(group.type)} ({nodeCount.available}/{nodeCount.total})
      </div>
    </div>
    
    {#if currentNodeName}
      <div class="flex items-center gap-2 shrink-0">
        <span class="text-xs text-[var(--color-text-secondary)] truncate max-w-[120px] flex items-center gap-1">
          <span class="opacity-60">◉</span>
          {currentNodeName}
        </span>
        {#if group.type === 'Selector'}
          <span class="text-[var(--color-primary)] opacity-60" title="Click to switch node">▾</span>
        {/if}
      </div>
    {/if}
  </div>

  <button
    onclick={(e) => {
      e.stopPropagation();
      onTestLatency();
    }}
    disabled={isTesting}
    class="text-xs px-2.5 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] shrink-0 min-w-[48px] text-center {
      isTesting 
        ? 'text-[var(--color-text-muted)]' 
        : failedTest
          ? 'text-red-500 hover:text-red-600 border-red-300'
          : groupLatency !== null && groupLatency !== undefined && groupLatency > 0
            ? getDelayColor(groupLatency!) + ' font-medium'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-primary)]'
    } transition-colors"
    title={failedTest ? 'Failed - Click to retry' : 'Test group latency'}
  >
    {#if isTesting}
      <span class="animate-spin inline-block">⏳</span>
    {:else if failedTest}
      <span class="text-red-500">!</span>
    {:else if groupLatency !== null && groupLatency !== undefined && groupLatency > 0}
      {formatGroupLatency(groupLatency!)}
    {:else}
      ⚡
    {/if}
  </button>
</div>
