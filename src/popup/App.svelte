<script lang="ts">
  import { onMount } from 'svelte';
  import { ClashAPI } from '$lib/services/clash-api';
  import { storage } from '$lib/services/storage';
  import type { ExtensionConfig, ClashVersion, ProxyNode, ProxyGroup, ThemeMode, Connection } from '$lib/types';
  import { PROXY_GROUP_TYPES } from '$lib/types';
  import { applyTheme, formatDelay, getDelayColor, getLatestDelay } from '$lib/utils';

  // ============================================
  // State Management (Svelte 5 Runes)
  // ============================================
  
  // Core state
  let configs = $state<ExtensionConfig[]>([]);
  let activeConfigId = $state<string | null>(null);
  let activeConfig = $derived<ExtensionConfig | undefined>(
    configs.find(c => c.id === activeConfigId)
  );
  
  // API and data state
  let api = $state<ClashAPI | null>(null);
  let version = $state<ClashVersion | null>(null);
  let proxyGroups = $state<ProxyGroup[]>([]);
  let allProxies = $state<Record<string, ProxyNode>>({});
  let connections = $state<Connection[]>([]);
  let isProxyEnabled = $state<boolean>(false);
  let theme = $state<ThemeMode>('system');
  
  // Current tab info
  let currentTabUrl = $state<string>('');
  let currentHostname = $state<string>('');
  
  // Loading states
  let isLoading = $state<boolean>(true);
  let isLoadingGroups = $state<boolean>(false);
  let isLoadingConnections = $state<boolean>(false);
  let isTogglingProxy = $state<boolean>(false);
  let testingLatencyGroups = $state<Set<string>>(new Set());
  let testingLatencyNodes = $state<Set<string>>(new Set());
  let switchingNodes = $state<Set<string>>(new Set());
  
  // Error states
  let apiError = $state<string>('');
  
  // Expanded groups for collapsible UI
  let expandedGroups = $state<Set<string>>(new Set());

  // ============================================
  // Derived State
  // ============================================
  
  let hasConfigs = $derived<boolean>(configs.length > 0);
  let hasMultipleConfigs = $derived<boolean>(configs.length > 1);
  
  let matchedConnection = $derived<Connection | undefined>(
    (!currentHostname || connections.length === 0) 
      ? undefined 
      : connections.find(conn => {
          const connHost = conn.metadata?.host || conn.metadata?.destinationIP || '';
          return connHost === currentHostname || 
                 currentHostname.includes(connHost) || 
                 connHost.includes(currentHostname);
        })
  );
  
  let currentTabDomain = $derived.by<string>(() => {
    try {
      return new URL(currentTabUrl).hostname;
    } catch {
      return currentTabUrl || 'No website';
    }
  });

  // ============================================
  // Effects
  // ============================================
  
  onMount(() => {
    // Initialize on mount
    initializePopup();
  });
  
  $effect(() => {
    // Apply theme changes
    if (theme) {
      applyTheme(theme);
    }
  });
  
  $effect(() => {
    // Fetch data when API instance changes
    if (api) {
      fetchAllData();
    }
  });

  // ============================================
  // Functions
  // ============================================
  
  async function initializePopup() {
    try {
      isLoading = true;
      apiError = '';
      
      // Load all configs and settings
      const [allConfigs, activeId, themeMode, proxyEnabled] = await Promise.all([
        storage.getConfigs(),
        storage.getActiveConfigId(),
        storage.getThemeMode(),
        storage.getProxyEnabled()
      ]);
      
      configs = Array.isArray(allConfigs) ? allConfigs : [];
      activeConfigId = activeId;
      theme = themeMode;
      isProxyEnabled = proxyEnabled;
      
      // Get current tab URL
      await getCurrentTabInfo();
      
      // Initialize API if we have an active config
      if (activeConfig) {
        api = new ClashAPI(activeConfig.host, activeConfig.port, activeConfig.secret);
      }
    } catch (err) {
      apiError = err instanceof Error ? err.message : 'Failed to initialize';
    } finally {
      isLoading = false;
    }
  }
  
  async function getCurrentTabInfo() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.url) {
        currentTabUrl = tabs[0].url;
        currentHostname = new URL(tabs[0].url).hostname;
      }
    } catch (err) {
      console.error('Failed to get current tab:', err);
    }
  }
  
  async function fetchAllData() {
    if (!api) return;
    
    await Promise.all([
      fetchVersion(),
      fetchProxyGroups(),
      fetchConnections()
    ]);
  }
  
  async function fetchVersion() {
    try {
      apiError = '';
      version = await api!.getVersion();
    } catch (err) {
      apiError = 'Failed to connect to Clash';
      console.error('Failed to fetch version:', err);
    }
  }
  
  async function fetchProxyGroups() {
    if (!api) return;
    
    try {
      isLoadingGroups = true;
      const response = await api.getProxies();
      allProxies = response.proxies || {};
      
      // Filter groups
      const groups: ProxyGroup[] = [];
      for (const [name, proxy] of Object.entries(allProxies)) {
        if (PROXY_GROUP_TYPES.includes(proxy.type as typeof PROXY_GROUP_TYPES[number])) {
          groups.push({
            name,
            type: proxy.type as ProxyGroup['type'],
            now: proxy.now || '',
            all: proxy.all || [],
            history: proxy.history || []
          });
        }
      }
      
      proxyGroups = groups.sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      console.error('Failed to fetch proxy groups:', err);
    } finally {
      isLoadingGroups = false;
    }
  }
  
  async function fetchConnections() {
    if (!api) return;
    
    try {
      isLoadingConnections = true;
      const data = await api.getConnections();
      connections = data.connections || [];
    } catch (err) {
      console.error('Failed to fetch connections:', err);
    } finally {
      isLoadingConnections = false;
    }
  }
  
  async function toggleProxy() {
    try {
      isTogglingProxy = true;
      await chrome.runtime.sendMessage({ type: 'TOGGLE_PROXY' });
      isProxyEnabled = !isProxyEnabled;
    } catch (err) {
      console.error('Failed to toggle proxy:', err);
    } finally {
      isTogglingProxy = false;
    }
  }
  
  async function switchConfig(configId: string) {
    if (configId === activeConfigId) return;
    
    try {
      await chrome.runtime.sendMessage({ 
        type: 'SWITCH_CONFIG', 
        payload: { configId } 
      });
      activeConfigId = configId;
      
      // Re-initialize with new config
      const config = configs.find(c => c.id === configId);
      if (config) {
        api = new ClashAPI(config.host, config.port, config.secret);
      }
    } catch (err) {
      console.error('Failed to switch config:', err);
    }
  }
  
  async function switchProxyNode(groupName: string, nodeName: string) {
    if (!api) return;
    
    try {
      switchingNodes.add(groupName);
      switchingNodes = switchingNodes; // Trigger reactivity
      
      await api.switchProxy(groupName, nodeName);
      
      // Refresh groups to show updated selection
      await fetchProxyGroups();
    } catch (err) {
      console.error('Failed to switch proxy:', err);
    } finally {
      switchingNodes.delete(groupName);
      switchingNodes = switchingNodes;
    }
  }
  
  async function testGroupLatency(groupName: string) {
    if (!api) return;
    
    try {
      testingLatencyGroups.add(groupName);
      testingLatencyGroups = testingLatencyGroups;
      
      const result = await api.testGroupDelay(groupName);
      
      // Update latencies in allProxies
      for (const [nodeName, delay] of Object.entries(result)) {
        if (allProxies[nodeName]) {
          allProxies[nodeName] = {
            ...allProxies[nodeName],
            history: [...(allProxies[nodeName].history || []), { time: new Date().toISOString(), delay }]
          };
        }
      }
      allProxies = allProxies; // Trigger reactivity
    } catch (err) {
      console.error('Failed to test group latency:', err);
    } finally {
      testingLatencyGroups.delete(groupName);
      testingLatencyGroups = testingLatencyGroups;
    }
  }
  
  async function testNodeLatency(nodeName: string) {
    if (!api) return;
    
    try {
      testingLatencyNodes.add(nodeName);
      testingLatencyNodes = testingLatencyNodes;
      
      const result = await api.testProxyDelay(nodeName);
      
      // Update latency in allProxies
      if (allProxies[nodeName]) {
        allProxies[nodeName] = {
          ...allProxies[nodeName],
          history: [...(allProxies[nodeName].history || []), { time: new Date().toISOString(), delay: result.delay }]
        };
        allProxies = allProxies; // Trigger reactivity
      }
    } catch (err) {
      console.error('Failed to test node latency:', err);
    } finally {
      testingLatencyNodes.delete(nodeName);
      testingLatencyNodes = testingLatencyNodes;
    }
  }
  
  function toggleTheme() {
    const themes: ThemeMode[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    theme = themes[(currentIndex + 1) % themes.length];
    storage.setThemeMode(theme);
  }
  
  function openSettings() {
    chrome.runtime.openOptionsPage();
  }
  
  function openDashboard() {
    if (activeConfig) {
      chrome.tabs.create({ url: `http://${activeConfig.host}:${activeConfig.port}/ui` });
    }
  }
  
  function toggleGroupExpanded(groupName: string) {
    if (expandedGroups.has(groupName)) {
      expandedGroups.delete(groupName);
    } else {
      expandedGroups.add(groupName);
    }
    expandedGroups = expandedGroups;
  }
  
  function getThemeIcon(): string {
    switch (theme) {
      case 'light': return '☀️';
      case 'dark': return '🌙';
      case 'system': return '🖥️';
    }
  }
  
  function getVersionBadge(): string {
    if (!version) return '';
    if (version.premium) return 'Premium';
    if (version.meta) return 'Meta';
    return '';
  }
  
  function getNodeLatency(nodeName: string): number | null {
    const node = allProxies[nodeName];
    if (!node) return null;
    return getLatestDelay(node.history);
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

<!-- ============================================ -->
<!-- Main Container -->
<!-- ============================================ -->
<div class="w-[420px] max-h-[550px] overflow-y-auto bg-[var(--color-bg)] text-[var(--color-text)] font-sans">
  
  <!-- Loading State -->
  {#if isLoading}
    <div class="flex items-center justify-center h-40">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]"></div>
    </div>
  
  <!-- No Config State -->
  {:else if !hasConfigs}
    <div class="flex flex-col items-center justify-center p-8 text-center">
      <div class="text-4xl mb-4">⚙️</div>
      <h2 class="text-lg font-semibold mb-2 text-[var(--color-text)]">No Configuration</h2>
      <p class="text-sm text-[var(--color-text-secondary)] mb-4">
        Please configure a Clash proxy to get started.
      </p>
      <button
        onclick={openSettings}
        class="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors text-sm font-medium"
      >
        Open Settings
      </button>
    </div>
  
  <!-- Main Content -->
  {:else}
    <!-- ============================================ -->
    <!-- Row 1: Header -->
    <!-- ============================================ -->
    <header class="sticky top-0 z-10 bg-[var(--color-bg)] border-b border-[var(--color-border)] px-5 py-4">
      <div class="flex items-center justify-between mb-2">
        <!-- Left: Active Config Info -->
        <div class="flex flex-col min-w-0">
          <div class="flex items-center gap-1.5">
            {#if activeConfig}
              <span class="text-base">{activeConfig.emoji}</span>
              <span class="text-sm font-bold text-[var(--color-text)] truncate">{activeConfig.name}</span>
            {:else}
              <span class="text-sm font-bold text-[var(--color-text)]">No Config</span>
            {/if}
            {#if getVersionBadge()}
              <span class="px-1.5 py-0.5 text-[10px] bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-full font-medium shrink-0">
                {getVersionBadge()}
              </span>
            {/if}
          </div>
          {#if activeConfig}
            <span class="text-xs text-[var(--color-text-muted)] truncate">
              {activeConfig.host}:{activeConfig.port}
              {#if version?.version}
                <span class="ml-1">v{version.version}</span>
              {/if}
              {#if isProxyEnabled}
                <span class="text-green-500 ml-1">● Proxy On</span>
              {/if}
            </span>
          {/if}
        </div>
        
        <!-- Right: Action Buttons -->
        <div class="flex items-center gap-2">
          <!-- Proxy Toggle -->
          <button
            onclick={toggleProxy}
            disabled={isTogglingProxy}
            class="p-2 rounded-lg border border-[var(--color-border)] transition-colors {isProxyEnabled 
              ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20' 
              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'}"
            title={isProxyEnabled ? 'Disable Proxy' : 'Enable Proxy'}
          >
            {#if isTogglingProxy}
              <span class="animate-spin inline-block">⏳</span>
            {:else}
              <span>{isProxyEnabled ? '🟢' : '⚪'}</span>
            {/if}
          </button>
          
          <!-- Settings -->
          <button
            onclick={openSettings}
            class="p-2 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] transition-colors"
            title="Settings"
          >
            ⚙️
          </button>
          
          <!-- Dashboard -->
          <button
            onclick={openDashboard}
            class="p-2 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] transition-colors"
            title="Open Dashboard"
          >
            📊
          </button>
          
          <!-- Theme Toggle -->
          <button
            onclick={toggleTheme}
            class="p-2 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] transition-colors"
            title="Toggle Theme ({theme})"
          >
            {getThemeIcon()}
          </button>
        </div>
      </div>
      
      <!-- Config Selector -->
      {#if hasMultipleConfigs}
        <div class="mt-3">
          <select
            value={activeConfigId || ''}
            onchange={(e) => switchConfig(e.currentTarget.value)}
            class="w-full px-3 py-2 text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            {#each configs as config}
              <option value={config.id}>{config.emoji} {config.name}</option>
            {/each}
          </select>
        </div>
      {/if}
      
      <!-- API Error -->
      {#if apiError}
        <div class="mt-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-500">
          {apiError}
        </div>
      {/if}
    </header>

    <!-- ============================================ -->
    <!-- Row 2: Rule Match -->
    <!-- ============================================ -->
    <section class="px-5 py-4 border-b border-[var(--color-border)]">
      <div class="grid grid-cols-2 gap-4">
        <!-- Left: Current Tab Info -->
        <div>
          <div class="flex items-center gap-2 mb-2">
            <span class="text-lg">🌐</span>
            <span class="text-sm font-medium text-[var(--color-text-secondary)] truncate">
              {currentTabDomain}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-lg">{matchedConnection ? '🟢' : '⚪'}</span>
            <span class="text-sm text-[var(--color-text-secondary)]">
              {matchedConnection ? 'Connected' : 'No Connection'}
            </span>
          </div>
        </div>
        
        <!-- Right: Rule Details -->
        <div class="text-right">
          {#if matchedConnection}
            <div class="mb-1">
              <span class="text-xs px-2 py-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded">
                {matchedConnection.rule}
              </span>
            </div>
            <div class="text-xs text-[var(--color-text-secondary)] mb-1">
              {matchedConnection.rulePayload || matchedConnection.metadata?.host || ''}
            </div>
            <div class="flex items-center justify-end gap-1 text-sm">
              <span>🚀</span>
              <span class="font-medium text-[var(--color-text)]">
                {matchedConnection.chains?.[0] || 'Direct'}
              </span>
              {#if matchedConnection.chains && matchedConnection.chains.length > 0}
                {@const delay = getNodeLatency(matchedConnection.chains[0])}
                {#if delay !== null}
                  <span class="text-xs {getDelayColor(delay)}">
                    ({formatDelay(delay)})
                  </span>
                {/if}
              {/if}
            </div>
          {:else}
            <div class="text-xs text-[var(--color-text-secondary)]">
              No rule matched
            </div>
          {/if}
        </div>
      </div>
    </section>

    <!-- ============================================ -->
    <!-- Row 3: Proxy Groups -->
    <!-- ============================================ -->
    <section class="px-5 py-4 pb-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-[var(--color-text)]">Proxy Groups</h3>
        <button
          onclick={fetchProxyGroups}
          disabled={isLoadingGroups}
          class="text-xs px-2 py-1 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] transition-colors"
        >
          {isLoadingGroups ? '⟳' : '🔄'} Refresh
        </button>
      </div>
      
      <!-- 2-Column Grid -->
      <div class="grid grid-cols-2 gap-2">
        {#each proxyGroups as group}
          {@const currentNodeName = group.now}
          {@const currentNodeLatency = currentNodeName ? getNodeLatency(currentNodeName) : null}
          {@const nodeCount = getGroupNodeCount(group)}
          
          <div
            class="relative bg-[var(--color-bg-secondary)] rounded-lg px-2.5 py-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          >
            <!-- Speed Test Button (top-right corner) -->
            <button
              onclick={(e) => {
                e.stopPropagation();
                testGroupLatency(group.name);
              }}
              disabled={testingLatencyGroups.has(group.name)}
              class="absolute top-1.5 right-1.5 text-xs p-0.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
              title="Test group latency"
            >
              {#if testingLatencyGroups.has(group.name)}
                <span class="animate-spin inline-block">⏳</span>
              {:else}
                ⚡
              {/if}
            </button>

            <!-- Clickable area for expanding group -->
            <button
              onclick={() => toggleGroupExpanded(group.name)}
              class="w-full text-left"
            >
              <!-- Row 1: Group Name -->
              <div class="text-sm font-semibold text-[var(--color-text)] truncate pr-5">
                {group.name}
              </div>
              
              <!-- Row 2: Type + Node Count -->
              <div class="text-xs text-[var(--color-text-secondary)]">
                {getGroupTypeLabel(group.type)} ({nodeCount.available}/{nodeCount.total})
              </div>
              
              <!-- Row 3: Current Node + Latency -->
              {#if currentNodeName}
                <div class="flex items-center justify-between mt-1">
                  <span class="text-xs text-[var(--color-text-secondary)] truncate flex-1 flex items-center gap-1">
                    <span class="opacity-60">◉</span>
                    {currentNodeName}
                  </span>
                  {#if testingLatencyGroups.has(group.name) || testingLatencyNodes.has(currentNodeName)}
                    <span class="animate-spin text-xs ml-1 shrink-0">⏳</span>
                  {:else if currentNodeLatency !== null && currentNodeLatency > 0}
                    <span class="text-xs font-medium ml-1 shrink-0 {getDelayColor(currentNodeLatency)}">
                      {currentNodeLatency}
                    </span>
                  {/if}
                </div>
              {/if}
            </button>
          </div>
        {/each}
      </div>
      
      {#if proxyGroups.length === 0}
        <div class="text-center py-8 text-sm text-[var(--color-text-secondary)]">
          No proxy groups found
        </div>
      {/if}
    </section>

    <!-- ============================================ -->
    <!-- Expanded Group Overlay -->
    <!-- ============================================ -->
    {#each proxyGroups as group}
      {#if expandedGroups.has(group.name)}
        {@const currentNodeName = group.now}
        <!-- Backdrop -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="fixed inset-0 bg-black/50 z-20"
          onclick={() => toggleGroupExpanded(group.name)}
          onkeydown={(e) => {
            if (e.key === 'Escape') toggleGroupExpanded(group.name);
          }}
        ></div>
        
        <!-- Panel -->
        <div class="fixed inset-x-0 bottom-0 z-30 bg-[var(--color-bg)] rounded-t-2xl max-h-[70vh] flex flex-col border-t border-[var(--color-border)]">
          <!-- Panel Header -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] shrink-0">
            <div>
              <div class="text-sm font-semibold text-[var(--color-text)]">{group.name}</div>
              <div class="text-xs text-[var(--color-text-secondary)]">{group.type} · {group.all?.length || 0} nodes</div>
            </div>
            <div class="flex items-center gap-2">
              <button
                onclick={() => testGroupLatency(group.name)}
                disabled={testingLatencyGroups.has(group.name)}
                class="text-xs px-2 py-1 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] transition-colors"
              >
                {testingLatencyGroups.has(group.name) ? '⏳ Testing...' : '⚡ Test All'}
              </button>
              <button
                onclick={() => toggleGroupExpanded(group.name)}
                class="text-sm p-1 rounded hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
          
          <!-- Node List -->
          <div class="overflow-y-auto flex-1 p-2">
            {#each group.all || [] as nodeName}
              {@const isSelected = nodeName === currentNodeName}
              {@const delay = getNodeLatency(nodeName)}
              {@const isSelector = group.type === 'Selector'}
              {#if isSelector}
                <!-- Selector: clickable node for switching -->
                <button
                  onclick={() => switchProxyNode(group.name, nodeName)}
                  disabled={isSelected || switchingNodes.has(group.name)}
                  class="w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors {isSelected 
                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' 
                    : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'}"
                >
                  <span class="truncate flex-1 text-left">{nodeName}</span>
                  <div class="flex items-center gap-1.5 ml-2 shrink-0">
                    {#if switchingNodes.has(group.name) && !isSelected}
                      <span class="animate-spin">⏳</span>
                    {:else if delay !== null && delay > 0}
                      <span class="{getDelayColor(delay)}">{delay}ms</span>
                    {:else if testingLatencyNodes.has(nodeName)}
                      <span class="animate-spin">⏳</span>
                    {:else}
                      <span
                        role="button"
                        tabindex="0"
                        onclick={(e) => {
                          e.stopPropagation();
                          testNodeLatency(nodeName);
                        }}
                        onkeydown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            testNodeLatency(nodeName);
                          }
                        }}
                        class="p-0.5 rounded hover:bg-[var(--color-bg-tertiary)] cursor-pointer"
                      >
                        ⚡
                      </span>
                    {/if}
                    {#if isSelected}
                      <span class="text-[var(--color-primary)]">✓</span>
                    {/if}
                  </div>
                </button>
              {:else}
                <!-- Non-selector: read-only node display -->
                <div
                  class="w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg {isSelected 
                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' 
                    : 'text-[var(--color-text-secondary)]'}"
                >
                  <span class="truncate flex-1 text-left">{nodeName}</span>
                  <div class="flex items-center gap-1.5 ml-2 shrink-0">
                    {#if delay !== null && delay > 0}
                      <span class="{getDelayColor(delay)}">{delay}ms</span>
                    {:else if testingLatencyNodes.has(nodeName)}
                      <span class="animate-spin">⏳</span>
                    {:else}
                      <span
                        role="button"
                        tabindex="0"
                        onclick={(e) => {
                          e.stopPropagation();
                          testNodeLatency(nodeName);
                        }}
                        onkeydown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            testNodeLatency(nodeName);
                          }
                        }}
                        class="p-0.5 rounded hover:bg-[var(--color-bg-tertiary)] cursor-pointer"
                      >
                        ⚡
                      </span>
                    {/if}
                    {#if isSelected}
                      <span class="text-[var(--color-primary)]">✓</span>
                    {/if}
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      {/if}
    {/each}
  {/if}
</div>

<style>
  /* Custom scrollbar for the popup */
  :global(*) {
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }
  
  :global(*::-webkit-scrollbar) {
    width: 6px;
  }
  
  :global(*::-webkit-scrollbar-track) {
    background: transparent;
  }
  
  :global(*::-webkit-scrollbar-thumb) {
    background-color: var(--color-border);
    border-radius: 3px;
  }
</style>
