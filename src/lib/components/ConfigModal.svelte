<script lang="ts">
  import { untrack } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import type { ExtensionConfig } from '$lib/types';
  import { ClashAPI } from '$lib/services/clash-api';

  let {
    configs,
    activeConfigId,
    isOpen = false,
    onClose = () => {},
    onSwitchConfig = (_: string) => {},
    onConfigsUpdate = (_: ExtensionConfig[]) => {}
  }: {
    configs: ExtensionConfig[];
    activeConfigId: string | null;
    isOpen: boolean;
    onClose?: () => void;
    onSwitchConfig?: (configId: string) => void;
    onConfigsUpdate?: (updatedConfigs: ExtensionConfig[]) => void;
  } = $props();

  let checkingConfigs = $state<Set<string>>(new Set());
  let healthCheckRun = 0;

  const activeConfig = $derived(configs.find(c => c.id === activeConfigId));

  async function checkAllConfigsHealth(configsToCheck: ExtensionConfig[]) {
    if (configsToCheck.length === 0) return;
    const runId = ++healthCheckRun;
    
    checkingConfigs = new Set(configsToCheck.map(config => config.id));
    
    const updatedConfigs = await Promise.all(configsToCheck.map(async (config) => {
      try {
        const api = new ClashAPI(config.host, config.port, config.secret);
        const isAvailable = await api.healthCheck(3000);
        return {
          ...config,
          status: isAvailable ? 'available' : 'unavailable',
        } satisfies ExtensionConfig;
      } catch {
        return {
          ...config,
          status: 'unavailable',
        } satisfies ExtensionConfig;
      }
    }));

    if (runId !== healthCheckRun || !isOpen) return;

    checkingConfigs = new Set();

    onConfigsUpdate(updatedConfigs);
  }

  $effect(() => {
    if (isOpen) {
      const configsToCheck = untrack(() => configs);
      void checkAllConfigsHealth(configsToCheck);
    } else {
      healthCheckRun += 1;
      checkingConfigs = new Set();
    }
  });

  function handleSelect(configId: string) {
    if (configId !== activeConfigId) {
      onSwitchConfig(configId);
    }
    onClose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    }
  }

  function getStatusIcon(status: string, isChecking: boolean): string {
    if (isChecking) return '⟳';
    switch (status) {
      case 'available': return '●';
      case 'unavailable': return '○';
      default: return '◐';
    }
  }

  function getStatusColor(status: string, isChecking: boolean): string {
    if (isChecking) return 'text-[var(--color-primary)] animate-pulse';
    switch (status) {
      case 'available': return 'text-[var(--color-success)]';
      case 'unavailable': return 'text-[var(--color-danger)]';
      default: return 'text-[var(--color-text-muted)]';
    }
  }
</script>

{#if isOpen}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 bg-black/50 z-40"
    transition:fade={{ duration: 150 }}
    onclick={onClose}
    onkeydown={handleKeydown}
    role="button"
    tabindex="0"
    aria-label="Close modal backdrop"
  ></div>
  
  <!-- Modal Container -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-3"
    transition:scale={{ start: 0.95, duration: 150 }}
  >
    <div
      class="bg-[var(--color-bg)] rounded-lg max-h-[400px] w-full max-w-sm flex flex-col border border-[var(--color-border)] shadow-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="config-modal-title"
      tabindex="-1"
      onkeydown={handleKeydown}
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] shrink-0">
        <div>
          <h2 id="config-modal-title" class="text-sm font-semibold text-[var(--color-text)]">
            选择配置
          </h2>
          <p class="text-xs text-[var(--color-text-secondary)] mt-0.5">
            {configs.length} 个可用配置
          </p>
        </div>
        
        <button
          onclick={onClose}
          class="p-1.5 rounded-md hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] transition-colors"
          aria-label="Close"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <!-- Config List -->
      <div class="overflow-y-auto flex-1 p-2">
        {#each configs as config}
          <button
            class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-all duration-150 text-left {config.id === activeConfigId ? 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30' : 'hover:bg-[var(--color-bg-secondary)] border border-transparent'} {config.status === 'unavailable' ? 'opacity-60' : ''}"
            onclick={() => handleSelect(config.id)}
          >
            <!-- Emoji -->
            <span class="text-base shrink-0 leading-none">{config.emoji}</span>
            
            <!-- Info -->
            <div class="flex-1 min-w-0 flex flex-col gap-0.5">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium truncate text-[var(--color-text)]">
                  {config.name}
                </span>
                
                <!-- 配置类型标签 -->
                {#if config.configType === 'proxy-only'}
                  <span class="px-1.5 py-0.5 text-[10px] font-medium bg-[var(--color-warning)]/10 text-[var(--color-warning)] rounded leading-none border border-[var(--color-warning)]/20 shrink-0">
                    纯代理
                  </span>
                {:else}
                  <span class="px-1.5 py-0.5 text-[10px] font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded leading-none border border-[var(--color-primary)]/20 shrink-0">
                    API
                  </span>
                {/if}
                
                {#if config.isDefault}
                  <span class="px-1.5 py-0.5 text-[10px] bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded shrink-0 leading-none">
                    默认
                  </span>
                {/if}
              </div>
              
              <!-- 显示不同端口信息 -->
              <div class="text-xs text-[var(--color-text-muted)] truncate">
                {#if config.configType === 'proxy-only'}
                  {config.host}:{config.proxyPort || '未设置'}
                {:else}
                  {config.host}:{config.port}
                {/if}
              </div>
            </div>
            
            <!-- Status & Check -->
            <div class="flex items-center gap-1.5 shrink-0">
              <span class="text-xs {getStatusColor(config.status, checkingConfigs.has(config.id))}">
                {getStatusIcon(config.status, checkingConfigs.has(config.id))}
              </span>
              
              {#if config.id === activeConfigId}
                <svg class="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              {/if}
            </div>
          </button>
        {/each}
      </div>
      
    </div>
  </div>
{/if}
