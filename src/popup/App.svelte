<script lang="ts">
  import { onMount } from 'svelte';
  import { ClashAPI } from '$lib/services/clash-api';
  import { storage } from '$lib/services/storage';
  import type { ExtensionConfig, ClashVersion, ProxyNode, ProxyGroup, ThemeMode, Connection, FontFamily } from '$lib/types';
  import { PROXY_GROUP_TYPES } from '$lib/types';
  import { applyTheme, formatDelay, getDelayColor, getLatestDelay, applyFontFamily } from '$lib/utils';
  import Header from '$lib/components/popup/Header.svelte';
  import RuleMatch from '$lib/components/popup/RuleMatch.svelte';
  import ProxyGroups from '$lib/components/popup/ProxyGroups.svelte';
  import ProxyGroupModal from '$lib/components/popup/ProxyGroupModal.svelte';

  let configs = $state<ExtensionConfig[]>([]);
  let activeConfigId = $state<string | null>(null);
  let activeConfig = $derived<ExtensionConfig | undefined>(
    configs.find(c => c.id === activeConfigId)
  );
  
  let api = $state<ClashAPI | null>(null);
  let version = $state<ClashVersion | null>(null);
  let proxyPort = $state<number | null>(null);
  let proxyGroups = $state<ProxyGroup[]>([]);
  let allProxies = $state<Record<string, ProxyNode>>({});
  let connections = $state<Connection[]>([]);
  let isProxyEnabled = $state<boolean>(false);
  let theme = $state<ThemeMode>('system');
  let fontFamily = $state<FontFamily>('system');
  let customFontFamily = $state<string>('');
  
  let currentTabUrl = $state<string>('');
  let currentHostname = $state<string>('');
  
  let isLoading = $state<boolean>(true);
  let isLoadingGroups = $state<boolean>(true);
  let isLoadingConnections = $state<boolean>(true);
  let isTogglingProxy = $state<boolean>(false);
  let testingLatencyGroups = $state<Set<string>>(new Set());
  let testingLatencyNodes = $state<Set<string>>(new Set());
  let failedTestGroups = $state<Set<string>>(new Set());
  let failedTestNodes = $state<Set<string>>(new Set());
  
  let apiError = $state<string>('');
  let expandedGroups = $state<Set<string>>(new Set());

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

  onMount(() => {
    initializePopup();
  });
  
  $effect(() => {
    if (theme) {
      applyTheme(theme);
    }
  });
  
  $effect(() => {
    if (fontFamily) {
      applyFontFamily(fontFamily, customFontFamily);
    }
  });
  
  $effect(() => {
    if (api) {
      fetchVersion();
      fetchProxyPort();
      setTimeout(() => fetchProxyGroups(), 50);
      setTimeout(() => fetchConnections(), 150);
    }
  });
  
  async function initializePopup() {
    try {
      isLoading = true;
      apiError = '';
      
      const [activeId, themeMode, proxyEnabled, allConfigs] = await Promise.all([
        storage.getActiveConfigId(),
        storage.getThemeMode(),
        storage.getProxyEnabled(),
        storage.getConfigs()
      ]);
      
      activeConfigId = activeId;
      theme = themeMode;
      isProxyEnabled = proxyEnabled;
      configs = Array.isArray(allConfigs) ? allConfigs : [];
      
      storage.getFontFamily().then(font => { fontFamily = font; });
      storage.getCustomFontFamily().then(customFont => { customFontFamily = customFont; });
      
      getCurrentTabInfo();
      
      const activeConfig = configs.find(c => c.id === activeConfigId);
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
  
  async function fetchVersion() {
    try {
      version = await api!.getVersion();
    } catch (err) {
      apiError = 'Failed to connect to Clash';
      console.error('Failed to fetch version:', err);
    }
  }
  
  async function fetchProxyPort() {
    try {
      const config = await api!.getConfig();
      const proxyType = activeConfig?.proxyType ?? 'http';
      if (config['mixed-port']) {
        proxyPort = config['mixed-port'];
      } else if (proxyType === 'socks') {
        proxyPort = config['socks-port'] || config.port || null;
      } else {
        proxyPort = config.port || config['socks-port'] || null;
      }
    } catch (err) {
      console.error('Failed to fetch proxy port:', err);
    }
  }
  
  async function fetchProxyGroups() {
    if (!api) return;
    
    try {
      isLoadingGroups = true;
      const response = await api.getProxies();
      allProxies = response.proxies || {};
      
      const groups: ProxyGroup[] = [];
      for (const [name, proxy] of Object.entries(allProxies)) {
        if (name === 'GLOBAL') continue;
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
      
      const globalProxy = allProxies['GLOBAL'];
      const sortIndex = globalProxy?.all ?? [];
      proxyGroups = groups.sort((a, b) => {
        const aIndex = sortIndex.indexOf(a.name);
        const bIndex = sortIndex.indexOf(b.name);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
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
    
    // 1. 记录当前代理状态
    const wasProxyEnabled = isProxyEnabled;
    
    try {
      isLoadingGroups = true;
      isLoadingConnections = true;
      apiError = '';
      
      // 2. 关闭当前代理（如果开着）
      if (isProxyEnabled) {
        await chrome.runtime.sendMessage({ type: 'TOGGLE_PROXY' });
        isProxyEnabled = false;
      }
      
      // 3. 清空显示内容
      proxyGroups = [];
      allProxies = {};
      connections = [];
      version = null;
      // matchedConnection 是 derived，清空 connections 后自动清空
      
      // 4. 切换到新配置
      await chrome.runtime.sendMessage({ 
        type: 'SWITCH_CONFIG', 
        payload: { configId } 
      });
      activeConfigId = configId;
      
      const config = configs.find(c => c.id === configId);
      if (!config) {
        throw new Error('Config not found');
      }
      
      // 5. 测试新配置连通性
      api = new ClashAPI(config.host, config.port, config.secret);
      const isAvailable = await api.healthCheck(3000);
      
      // Update config status
      const configIndex = configs.findIndex(c => c.id === configId);
      if (configIndex !== -1) {
        configs[configIndex].status = isAvailable ? 'available' : 'unavailable';
        configs = [...configs];
      }
      
      if (!isAvailable) {
        // 6. 如果连不通：报错，保持关闭，不获取数据
        apiError = '无法连接到新配置';
        isLoadingGroups = false;
        isLoadingConnections = false;
        return;
      }
      
      // 7. 能连通：获取代理配置和信息
      await fetchVersion();
      await fetchProxyGroups();
      await fetchConnections();
      
      // 8. 如果之前代理是开启的，自动开启代理
      if (wasProxyEnabled) {
        await chrome.runtime.sendMessage({ type: 'TOGGLE_PROXY' });
        isProxyEnabled = true;
      }
      // 如果之前是关闭的，保持关闭（不需要操作）
      
    } catch (err) {
      console.error('Failed to switch config:', err);
      apiError = '切换配置失败';
      // 确保代理保持关闭
      if (isProxyEnabled) {
        await chrome.runtime.sendMessage({ type: 'TOGGLE_PROXY' });
        isProxyEnabled = false;
      }
    } finally {
      isLoadingGroups = false;
      isLoadingConnections = false;
    }
  }
  
  async function switchProxyNode(groupName: string, nodeName: string) {
    if (!api) return;
    
    try {
      await api.switchProxy(groupName, nodeName);
      expandedGroups.delete(groupName);
      expandedGroups = expandedGroups;
      await fetchProxyGroups();
    } catch (err) {
      console.error('Failed to switch proxy:', err);
    }
  }
  
  async function testGroupLatency(groupName: string) {
    if (!api) return;
    
    try {
      testingLatencyGroups.add(groupName);
      testingLatencyGroups = testingLatencyGroups;
      failedTestGroups.delete(groupName);
      failedTestGroups = failedTestGroups;
      
      const result = await api.testGroupDelay(groupName);
      
      for (const [nodeName, delay] of Object.entries(result)) {
        if (allProxies[nodeName]) {
          allProxies[nodeName] = {
            ...allProxies[nodeName],
            history: [...(allProxies[nodeName].history || []), { time: new Date().toISOString(), delay }]
          };
        }
      }
      allProxies = allProxies;
    } catch (err) {
      console.error('Failed to test group latency:', err);
      failedTestGroups.add(groupName);
      failedTestGroups = failedTestGroups;
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
      failedTestNodes.delete(nodeName);
      failedTestNodes = failedTestNodes;
      
      const result = await api.testProxyDelay(nodeName);
      
      if (allProxies[nodeName]) {
        allProxies[nodeName] = {
          ...allProxies[nodeName],
          history: [...(allProxies[nodeName].history || []), { time: new Date().toISOString(), delay: result.delay }]
        };
        allProxies = allProxies;
      }
    } catch (err) {
      console.error('Failed to test node latency:', err);
      failedTestNodes.add(nodeName);
      failedTestNodes = failedTestNodes;
    } finally {
      testingLatencyNodes.delete(nodeName);
      testingLatencyNodes = testingLatencyNodes;
    }
  }
  
  function updateConfigs(updatedConfigs: ExtensionConfig[]) {
    configs = updatedConfigs;
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
      expandedGroups.clear();
      expandedGroups.add(groupName);
    }
    expandedGroups = new Set(expandedGroups);
  }
  
  function getNodeLatency(nodeName: string): number | null {
    const node = allProxies[nodeName];
    if (!node) return null;
    return getLatestDelay(node.history);
  }
</script>

<div class="w-[420px] max-h-[550px] overflow-y-auto bg-[var(--color-bg)] text-[var(--color-text)] font-sans">
  {#if !isLoading && !hasConfigs}
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
  {:else}
    <Header
      {activeConfig}
      {version}
      {proxyPort}
      {isProxyEnabled}
      {isLoading}
      {theme}
      {isTogglingProxy}
      {hasMultipleConfigs}
      {configs}
      {activeConfigId}
      {apiError}
      onToggleProxy={toggleProxy}
      onOpenSettings={openSettings}
      onOpenDashboard={openDashboard}
      onToggleTheme={toggleTheme}
      onSwitchConfig={switchConfig}
      onConfigsUpdate={updateConfigs}
    />
    
    <RuleMatch
      {currentTabDomain}
      {matchedConnection}
      {isLoading}
      {allProxies}
    />
    
    <ProxyGroups
      {proxyGroups}
      isLoading={isLoading || isLoadingGroups}
      {allProxies}
      {testingLatencyGroups}
      {failedTestGroups}
      onRefresh={fetchProxyGroups}
      onTestLatency={testGroupLatency}
      onToggleExpanded={toggleGroupExpanded}
    />
  {/if}
  
  {#each proxyGroups as group}
    {#if expandedGroups.has(group.name)}
      <ProxyGroupModal
        {group}
        {allProxies}
        isTestingGroup={testingLatencyGroups.has(group.name)}
        failedTestGroup={failedTestGroups.has(group.name)}
        testingNodes={testingLatencyNodes}
        failedTestNodes={failedTestNodes}
        onClose={() => toggleGroupExpanded(group.name)}
        onTestLatency={() => testGroupLatency(group.name)}
        onTestNodeLatency={testNodeLatency}
        onSwitchNode={switchProxyNode}
      />
    {/if}
  {/each}
</div>

<style>
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
