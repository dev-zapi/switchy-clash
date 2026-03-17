<script lang="ts">
  import type { ExtensionConfig } from '$lib/types';

  let {
    configs,
    activeConfigId,
    onSwitchConfig,
    disabled = false
  }: {
    configs: ExtensionConfig[];
    activeConfigId: string | null;
    onSwitchConfig: (configId: string) => void;
    disabled?: boolean;
  } = $props();

  let isOpen = $state(false);
  let dropdownRef = $state<HTMLDivElement | null>(null);

  const activeConfig = $derived(configs.find(c => c.id === activeConfigId));

  function toggleDropdown() {
    if (!disabled) {
      isOpen = !isOpen;
    }
  }

  function selectConfig(configId: string) {
    if (configId !== activeConfigId) {
      onSwitchConfig(configId);
    }
    isOpen = false;
  }

  function handleClickOutside(event: MouseEvent) {
    if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
      isOpen = false;
    }
  }

  function getStatusIcon(status: string): string {
    switch (status) {
      case 'available': return '●';
      case 'unavailable': return '○';
      default: return '◐';
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'available': return 'text-[var(--color-success)]';
      case 'unavailable': return 'text-[var(--color-danger)]';
      default: return 'text-[var(--color-text-muted)]';
    }
  }

  $effect(() => {
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
    } else {
      document.removeEventListener('click', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<div class="relative" bind:this={dropdownRef}>
  <!-- Trigger Button -->
  <button
    onclick={toggleDropdown}
    disabled={disabled}
    class="w-9 h-9 flex items-center justify-center rounded-md shadow bg-[var(--color-bg-secondary)] text-[var(--color-primary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-primary-hover)] transition-all duration-200 border border-[var(--color-border)] disabled:opacity-50 disabled:cursor-not-allowed"
    title="Switch Config"
    aria-expanded={isOpen}
    aria-haspopup="true"
  >
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      class="h-5 w-5 transition-transform duration-200 {isOpen ? 'rotate-180' : ''}" 
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  <!-- Dropdown Menu -->
  {#if isOpen}
    <div 
      class="absolute right-0 mt-2 w-56 rounded-lg shadow-lg border border-[var(--color-border)] bg-[var(--color-bg)] py-1 z-50 animate-dropdown"
      role="menu"
    >
      <div class="px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
        选择配置
      </div>
      
      {#each configs as config}
        <button
          class="w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors duration-150 hover:bg-[var(--color-bg-secondary)] {config.id === activeConfigId ? 'bg-[var(--color-primary)]/5 text-[var(--color-primary)]' : 'text-[var(--color-text)]'}"
          onclick={() => selectConfig(config.id)}
          role="menuitem"
        >
          <span class="text-lg shrink-0">{config.emoji}</span>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">{config.name}</div>
            <div class="text-xs text-[var(--color-text-muted)] truncate">
              {config.host}:{config.port}
            </div>
          </div>
          <span class="text-xs shrink-0 {getStatusColor(config.status)}">
            {getStatusIcon(config.status)}
          </span>
          {#if config.id === activeConfigId}
            <svg class="w-4 h-4 shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .animate-dropdown {
    animation: dropdownFade 0.15s ease-out;
    transform-origin: top right;
  }

  @keyframes dropdownFade {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-4px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
</style>
