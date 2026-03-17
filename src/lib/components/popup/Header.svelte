<script lang="ts">
  import type { ExtensionConfig, ClashVersion, ThemeMode } from '$lib/types';
  import Skeleton from '../Skeleton.svelte';

  let {
    activeConfig,
    version,
    isProxyEnabled,
    isLoading,
    theme,
    isTogglingProxy,
    hasMultipleConfigs,
    configs,
    activeConfigId,
    apiError,
    onToggleProxy = () => {},
    onOpenSettings = () => {},
    onOpenDashboard = () => {},
    onToggleTheme = () => {},
    onSwitchConfig = (_: string) => {}
  }: {
    activeConfig?: ExtensionConfig;
    version?: ClashVersion | null;
    isProxyEnabled: boolean;
    isLoading: boolean;
    theme: ThemeMode;
    isTogglingProxy: boolean;
    hasMultipleConfigs: boolean;
    configs: ExtensionConfig[];
    activeConfigId: string | null;
    apiError: string;
    onToggleProxy?: () => void;
    onOpenSettings?: () => void;
    onOpenDashboard?: () => void;
    onToggleTheme?: () => void;
    onSwitchConfig?: (configId: string) => void;
  } = $props();

  function getVersionBadge(): string {
    if (!version) return '';
    if (version.premium) return 'Premium';
    if (version.meta) return 'Meta';
    return '';
  }

  function getThemeIcon(): string {
    switch (theme) {
      case 'light': return '☀️';
      case 'dark': return '🌙';
      case 'system': return '🖥️';
    }
  }
</script>

<header class="sticky top-0 z-10 bg-[var(--color-bg)] border-b border-[var(--color-border)] px-3 py-4">
  <div class="flex items-center justify-between mb-2">
    <!-- Left: Config Selector / Display -->
    <div class="flex flex-col min-w-0 flex-1">
      {#if isLoading}
        <div class="flex items-center gap-1.5">
          <Skeleton variant="circular" width="16px" height="16px" />
          <Skeleton variant="text" width="100px" />
        </div>
        <div class="mt-1"><Skeleton variant="text" width="150px" /></div>
      {:else}
        {#if activeConfig}
          <!-- Single Config: Display only -->
          {#if !hasMultipleConfigs}
            <div class="flex items-center gap-1.5">
              <span class="text-base">{activeConfig.emoji}</span>
              <span class="text-sm font-bold text-[var(--color-text)] truncate">{activeConfig.name}</span>
              {#if getVersionBadge()}
                <span class="px-1.5 py-0.5 text-[10px] bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-full font-medium shrink-0">
                  {getVersionBadge()}
                </span>
              {/if}
            </div>
            <span class="text-xs text-[var(--color-text-muted)] truncate">
              {activeConfig.host}:{activeConfig.port}
              {#if version?.version}
                <span class="ml-1">{version.version}</span>
              {/if}
              {#if isProxyEnabled}
                <span class="text-green-500 ml-1">Proxy On</span>
              {/if}
            </span>
          {:else}
            <!-- Multiple Configs: With dropdown -->
            <div class="flex items-center gap-1.5">
              <span class="text-base">{activeConfig.emoji}</span>
              <span class="text-sm font-bold text-[var(--color-text)] truncate">{activeConfig.name}</span>
              {#if getVersionBadge()}
                <span class="px-1.5 py-0.5 text-[10px] bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-full font-medium shrink-0">
                  {getVersionBadge()}
                </span>
              {/if}
            </div>
            <span class="text-xs text-[var(--color-text-muted)] truncate">
              {activeConfig.host}:{activeConfig.port}
              {#if version?.version}
                <span class="ml-1">{version.version}</span>
              {/if}
              {#if isProxyEnabled}
                <span class="text-green-500 ml-1">Proxy On</span>
              {/if}
            </span>
          {/if}
        {:else}
          <span class="text-sm font-bold text-[var(--color-text)]">No Config</span>
        {/if}
      {/if}
    </div>
    
    <!-- Right: Action Buttons -->
    <div class="flex items-center gap-2">
      {#if isLoading}
        <Skeleton variant="circular" width="36px" height="36px" />
        <Skeleton variant="circular" width="36px" height="36px" />
        <Skeleton variant="circular" width="36px" height="36px" />
        <Skeleton variant="circular" width="36px" height="36px" />
      {:else}
        <!-- Config Switcher Button (only for multiple configs) -->
        {#if hasMultipleConfigs && !isLoading}
          <div class="relative">
            <select
              value={activeConfigId || ''}
              onchange={(e) => onSwitchConfig(e.currentTarget.value)}
              class="absolute inset-0 opacity-0 cursor-pointer"
              title="Switch Config"
            >
              {#each configs as config}
                <option value={config.id}>{config.emoji} {config.name}</option>
              {/each}
            </select>
            <button
              class="w-9 h-9 flex items-center justify-center rounded-md shadow bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
              title="Switch Config"
            >
              🔄
            </button>
          </div>
        {/if}
        
        <!-- Proxy Toggle -->
        <button
          onclick={onToggleProxy}
          disabled={isTogglingProxy}
          class="w-9 h-9 flex items-center justify-center rounded-md shadow transition-colors {isProxyEnabled 
            ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' 
            : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'}"
          title={isProxyEnabled ? 'Disable Proxy' : 'Enable Proxy'}
        >
          {#if isTogglingProxy}
            <span class="animate-spin inline-block">⏳</span>
          {:else}
            <span>{isProxyEnabled ? '✓' : '⚪'}</span>
          {/if}
        </button>
        
        <!-- Settings -->
        <button
          onclick={onOpenSettings}
          class="w-9 h-9 flex items-center justify-center rounded-md shadow bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
          title="Settings"
        >
          ⚙️
        </button>
        
        <!-- Dashboard -->
        <button
          onclick={onOpenDashboard}
          class="w-9 h-9 flex items-center justify-center rounded-md shadow bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
          title="Open Dashboard"
        >
          📊
        </button>
        
        <!-- Theme Toggle -->
        <button
          onclick={onToggleTheme}
          class="w-9 h-9 flex items-center justify-center rounded-md shadow bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
          title="Toggle Theme ({theme})"
        >
          {getThemeIcon()}
        </button>
      {/if}
    </div>
  </div>
  
  <!-- API Error -->
  {#if apiError}
    <div class="mt-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-500">
      {apiError}
    </div>
  {/if}
</header>
