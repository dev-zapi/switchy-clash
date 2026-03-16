<script lang="ts">
  import type { ProxyGroup } from '$lib/types';
  import Skeleton from '../Skeleton.svelte';
  import ProxyGroupCard from './ProxyGroupCard.svelte';

  let {
    proxyGroups,
    isLoading,
    allProxies,
    testingLatencyGroups,
    failedTestGroups,
    onRefresh = () => {},
    onTestLatency = (_: string) => {},
    onToggleExpanded = (_: string) => {}
  }: {
    proxyGroups: ProxyGroup[];
    isLoading: boolean;
    allProxies: Record<string, any>;
    testingLatencyGroups: Set<string>;
    failedTestGroups: Set<string>;
    onRefresh?: () => void;
    onTestLatency?: (groupName: string) => void;
    onToggleExpanded?: (groupName: string) => void;
  } = $props();

  function getNodeLatency(nodeName: string): number | null {
    const node = allProxies[nodeName];
    if (!node) return null;
    const history = node.history || [];
    if (history.length === 0) return null;
    return history[history.length - 1].delay;
  }

  function getGroupNodeCount(group: ProxyGroup): { available: number; total: number } {
    const total = group.all?.length || 0;
    let available = 0;
    for (const nodeName of group.all || []) {
      const delay = getNodeLatency(nodeName);
      if (delay !== null && delay > 0) {
        available++;
      }
    }
    return { available, total };
  }
</script>

<section class="px-3 py-4 pb-5">
  <div class="flex items-center justify-between mb-3">
    <h3 class="text-sm font-semibold text-[var(--color-text)]">Proxy Groups</h3>
    <button
      onclick={onRefresh}
      disabled={isLoading}
      class="text-xs px-2 py-1 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] transition-colors"
    >
      {isLoading ? '⟳' : '🔄'} Refresh
    </button>
  </div>
  
  <div class="grid grid-cols-2 gap-2">
    {#if isLoading && proxyGroups.length === 0}
      {#each Array(4) as _}
        <Skeleton variant="rectangular" width="100%" height="80px" />
      {/each}
    {:else}
      {#each proxyGroups as group}
        {@const currentNodeName = group.now}
        {@const currentNodeLatency = currentNodeName ? getNodeLatency(currentNodeName) : null}
        {@const nodeCount = getGroupNodeCount(group)}
        
        <ProxyGroupCard
          {group}
          currentNodeName={currentNodeName}
          {currentNodeLatency}
          {nodeCount}
          isTesting={testingLatencyGroups.has(group.name)}
          failedTest={failedTestGroups.has(group.name)}
          onTestLatency={() => onTestLatency(group.name)}
          onToggleExpanded={() => onToggleExpanded(group.name)}
        />
      {/each}
    {/if}
  </div>
  
  {#if !isLoading && proxyGroups.length === 0}
    <div class="text-center py-8 text-sm text-[var(--color-text-secondary)]">
      No proxy groups found
    </div>
  {/if}
</section>
