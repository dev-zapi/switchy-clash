<script lang="ts">
  import type { ExtensionConfig, ClashVersion, ThemeMode } from '$lib/types';
  import Skeleton from '../Skeleton.svelte';
  import ConfigModal from '../ConfigModal.svelte';

  let isConfigModalOpen = $state(false);

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
    onSwitchConfig = (_: string) => {},
    onConfigsUpdate = (_: ExtensionConfig[]) => {}
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
    onConfigsUpdate?: (updatedConfigs: ExtensionConfig[]) => void;
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
        <Skeleton variant="circular" width="32px" height="32px" />
        <Skeleton variant="circular" width="32px" height="32px" />
        <Skeleton variant="circular" width="32px" height="32px" />
        <Skeleton variant="circular" width="32px" height="32px" />
      {:else}
        <!-- Config Switcher Button (only for multiple configs) -->
        {#if hasMultipleConfigs && !isLoading}
          <button
            onclick={() => isConfigModalOpen = true}
            class="w-8 h-8 flex items-center justify-center rounded-md shadow bg-[var(--color-bg-secondary)] text-[var(--color-primary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-primary-hover)] transition-all duration-200 border border-[var(--color-border)]"
            title="Switch Config"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        {/if}
        
        <!-- Proxy Toggle -->
        <button
          onclick={onToggleProxy}
          disabled={isTogglingProxy}
          class="w-12 h-8 flex items-center justify-center rounded-md shadow-md border-2 transition-all {isProxyEnabled 
            ? 'bg-[var(--color-success)] border-[var(--color-success)] text-white hover:brightness-110' 
            : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)]'}"
          title={isProxyEnabled ? 'Disable Proxy' : 'Enable Proxy'}
        >
          {#if isTogglingProxy}
            <svg class="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          {:else}
            <span class="font-bold text-xs">{isProxyEnabled ? 'ON' : 'OFF'}</span>
          {/if}
        </button>
        
        <!-- Settings -->
        <button
          onclick={onOpenSettings}
          class="w-8 h-8 flex items-center justify-center rounded-md shadow bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)] transition-all duration-200 border border-[var(--color-border)]"
          title="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        
        <!-- Dashboard -->
        <button
          onclick={onOpenDashboard}
          class="w-8 h-8 flex items-center justify-center rounded-md shadow bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)] transition-all duration-200 border border-[var(--color-border)]"
          title="Open Dashboard"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </button>
        
        <!-- Theme Toggle -->
        <button
          onclick={onToggleTheme}
          class="w-8 h-8 flex items-center justify-center rounded-md shadow bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)] transition-all duration-200 border border-[var(--color-border)]"
          title="Toggle Theme ({theme})"
        >
          {#if theme === 'light'}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[var(--color-warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          {:else if theme === 'dark'}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          {/if}
        </button>
      {/if}
    </div>
  </div>
  
  <!-- API Error -->
  {#if apiError}
    <div class="mt-2 px-3 py-2 bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 rounded-lg text-xs text-[var(--color-danger)] flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{apiError}</span>
    </div>
  {/if}
</header>

<!-- Config Modal -->
<ConfigModal
  {configs}
  {activeConfigId}
  isOpen={isConfigModalOpen}
  onClose={() => isConfigModalOpen = false}
  onSwitchConfig={onSwitchConfig}
  onConfigsUpdate={onConfigsUpdate}
/>
