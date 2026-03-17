<script lang="ts">
  import type { ProxyGroup } from '$lib/types';
  import LatencyButton from '../LatencyButton.svelte';

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

<div class="relative bg-[var(--color-bg-secondary)] rounded-md px-3 py-1.5 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex items-center gap-3">
  <div
    onclick={onToggleExpanded}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') onToggleExpanded();
    }}
    role="button"
    tabindex="0"
    class="flex-1 min-w-0 flex items-center gap-2"
  >
    <div class="flex-1 min-w-0 flex items-center gap-1.5">
      <div class="text-xs font-semibold text-[var(--color-text)] truncate">
        {group.name}
      </div>
      
      <span class="text-[10px] px-1 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
        {getGroupTypeLabel(group.type)}
      </span>
      
      <span class="text-[10px] text-[var(--color-text-muted)]">
        ({nodeCount.available}/{nodeCount.total})
      </span>
    </div>
    
    {#if currentNodeName}
      <div class="flex items-center gap-1.5 shrink-0">
        <span class="text-[11px] text-[var(--color-text-secondary)] truncate max-w-[100px] flex items-center gap-1">
          <span class="opacity-60">◉</span>
          {currentNodeName}
        </span>
        {#if group.type === 'Selector'}
          <span class="text-[10px] text-[var(--color-primary)] opacity-60" title="Click to switch node">▾</span>
        {/if}
      </div>
    {/if}
  </div>

  <LatencyButton
    delay={groupLatency}
    isTesting={isTesting}
    failed={failedTest}
    onTest={onTestLatency}
    size="sm"
    formatGroupDelay={true}
  />
</div>
