<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import type { ProxyGroup } from '$lib/types';
  import LatencyButton from '../LatencyButton.svelte';

  let {
    group,
    allProxies,
    isTestingGroup,
    failedTestGroup,
    testingNodes,
    failedTestNodes,
    onClose = () => {},
    onTestLatency = () => {},
    onTestNodeLatency = (_: string) => {},
    onSwitchNode = (_: string, __: string) => {}
  }: {
    group: ProxyGroup;
    allProxies: Record<string, any>;
    isTestingGroup: boolean;
    failedTestGroup: boolean;
    testingNodes: Set<string>;
    failedTestNodes: Set<string>;
    onClose?: () => void;
    onTestLatency?: () => void;
    onTestNodeLatency?: (nodeName: string) => void;
    onSwitchNode?: (groupName: string, nodeName: string) => void;
  } = $props();

  function getNodeLatency(nodeName: string): number | null {
    const node = allProxies[nodeName];
    if (!node) return null;
    const history = node.history || [];
    if (history.length === 0) return null;
    return history[history.length - 1].delay;
  }

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

  function getSortedNodes(): string[] {
    const nodes = [...(group.all || [])];
    const currentNode = group.now;
    
    return nodes.sort((a, b) => {
      if (a === currentNode) return -1;
      if (b === currentNode) return 1;
      
      const delayA = getNodeLatency(a);
      const delayB = getNodeLatency(b);
      const hasA = delayA !== null && delayA > 0;
      const hasB = delayB !== null && delayB > 0;
      
      if (hasA && !hasB) return -1;
      if (!hasA && hasB) return 1;
      
      if (hasA && hasB) return delayA! - delayB!;
      
      return 0;
    });
  }
</script>

{#if true}
  <div
    class="fixed inset-0 bg-black/50 z-20"
    transition:fade={{ duration: 150 }}
    onclick={onClose}
    onkeydown={(e) => {
      if (e.key === 'Escape') onClose();
    }}
    role="button"
    tabindex="0"
    aria-label="Close modal backdrop"
  ></div>
  
  <div
    class="fixed inset-0 z-30 flex items-center justify-center p-3 pointer-events-none"
    transition:scale={{ start: 0.95, duration: 150 }}
  >
    <div
      class="bg-[var(--color-bg)] rounded-lg max-h-[70vh] w-full flex flex-col border border-[var(--color-border)] shadow-xl pointer-events-auto"
    >
      <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] shrink-0">
        <div>
          <div class="text-sm font-semibold text-[var(--color-text)]">{group.name}</div>
          <div class="text-xs text-[var(--color-text-secondary)]">{group.type} · {group.all?.length || 0} nodes</div>
        </div>
        <div class="flex items-center gap-2">
          <LatencyButton
            isTesting={isTestingGroup}
            failed={failedTestGroup}
            onTest={onTestLatency}
            size="md"
          />
          <button
            onclick={onClose}
            class="text-sm p-1 rounded hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
      
      <div class="overflow-y-auto flex-1 p-2">
        {#each getSortedNodes() as nodeName}
          {@const isSelected = nodeName === group.now}
          {@const delay = getNodeLatency(nodeName)}
          {@const isSelector = group.type === 'Selector'}
          {#if isSelector}
            <div
              onclick={() => {
                if (!isSelected) onSwitchNode(group.name, nodeName);
              }}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  if (!isSelected) onSwitchNode(group.name, nodeName);
                }
              }}
              role="option"
              aria-selected={isSelected}
              tabindex="0"
              class="w-full flex items-center justify-between px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer {isSelected 
                ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' 
                : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'}"
            >
              <span class="truncate flex-1 text-left">{nodeName}</span>
              <div class="flex items-center gap-1 ml-2 shrink-0 h-5">
                <LatencyButton
                  {delay}
                  isTesting={testingNodes.has(nodeName)}
                  failed={failedTestNodes.has(nodeName)}
                  onTest={() => onTestNodeLatency(nodeName)}
                  size="sm"
                />
                {#if isSelected}
                  <span class="text-[var(--color-primary)] w-4 text-center">✓</span>
                {/if}
              </div>
            </div>
          {:else}
            <div
              class="w-full flex items-center justify-between px-3 py-1.5 text-xs rounded-md {isSelected 
                ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' 
                : 'text-[var(--color-text-secondary)]'}"
            >
              <span class="truncate flex-1 text-left">{nodeName}</span>
              <div class="flex items-center gap-1 ml-2 shrink-0 h-5">
                <LatencyButton
                  {delay}
                  isTesting={testingNodes.has(nodeName)}
                  failed={failedTestNodes.has(nodeName)}
                  onTest={() => onTestNodeLatency(nodeName)}
                  size="sm"
                />
                {#if isSelected}
                  <span class="text-[var(--color-primary)] w-4 text-center">✓</span>
                {/if}
              </div>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  </div>
{/if}
