<script lang="ts">
  import type { Connection } from '$lib/types';
  import Skeleton from '../Skeleton.svelte';

  let {
    currentTabDomain,
    matchedConnection,
    isLoading,
    allProxies
  }: {
    currentTabDomain: string;
    matchedConnection?: Connection;
    isLoading: boolean;
    allProxies: Record<string, any>;
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
</script>

<section class="px-3 py-2 border-b border-[var(--color-border)]">
  {#if isLoading}
    <div class="flex flex-col gap-1.5">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <Skeleton variant="circular" width="16px" height="16px" />
          <Skeleton variant="text" width="120px" />
        </div>
        <Skeleton variant="text" width="80px" />
      </div>
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <Skeleton variant="circular" width="12px" height="12px" />
          <Skeleton variant="text" width="80px" />
        </div>
        <Skeleton variant="text" width="100px" />
      </div>
    </div>
  {:else}
    <div class="flex flex-col gap-1.5">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="text-sm shrink-0">🌐</span>
          <span class="text-xs font-medium text-[var(--color-text)] truncate">
            {currentTabDomain}
          </span>
        </div>
        {#if matchedConnection}
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="text-xs px-1.5 py-0.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded">
              {matchedConnection.rule}
            </span>
            {#if matchedConnection.rulePayload}
              <span class="text-xs text-[var(--color-text-secondary)]">
                {matchedConnection.rulePayload}
              </span>
            {/if}
          </div>
        {/if}
      </div>
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <span class="text-sm">{matchedConnection ? '🟢' : '⚪'}</span>
          <span class="text-xs text-[var(--color-text-secondary)]">
            {matchedConnection ? 'Connected' : 'No Connection'}
          </span>
        </div>
        {#if matchedConnection}
          <div class="flex items-center gap-1.5 text-xs">
            <span>🚀</span>
            <span class="font-medium text-[var(--color-text)]">
              {matchedConnection.chains?.[0] || 'Direct'}
            </span>
            {#if matchedConnection.chains && matchedConnection.chains.length > 0}
              {@const delay = getNodeLatency(matchedConnection.chains[0])}
              {#if delay !== null}
                <span class="{getDelayColor(delay)}">
                  ({formatDelay(delay)})
                </span>
              {/if}
            {/if}
          </div>
        {:else}
          <span class="text-xs text-[var(--color-text-secondary)]">No rule matched</span>
        {/if}
      </div>
    </div>
  {/if}
</section>
