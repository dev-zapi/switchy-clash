<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
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
  let testingLatencyGroups = $state<SvelteSet<string>>(new SvelteSet());
  let testingLatencyNodes = $state<SvelteSet<string>>(new SvelteSet());
  let failedTestGroups = $state<SvelteSet<string>>(new SvelteSet());
  let failedTestNodes = $state<SvelteSet<string>>(new SvelteSet());
  const groupLatencyTestRuns = new Map<string, symbol>();
  const nodeLatencyTestRuns = new Map<string, symbol>();
  
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
      // 只有 API 类型才加载代理组和连接
      if (activeConfig?.configType === 'api') {
        setTimeout(() => fetchProxyGroups(), 50);
        setTimeout(() => fetchConnections(), 150);
      } else {
        // 纯代理模式清空代理组和连接数据
        proxyGroups = [];
        allProxies = {};
        connections = [];
        isLoadingGroups = false;
        isLoadingConnections = false;
      }
    }
  });
  
  $effect(() => {
    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      if (changes.proxyEnabled?.newValue !== undefined) {
        isProxyEnabled = changes.proxyEnabled.newValue as boolean;
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
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
        // 纯代理模式处理
        if (activeConfig.configType === 'proxy-only') {
          proxyPort = activeConfig.proxyPort || null;
          api = null;
          version = null;
          proxyGroups = [];
          allProxies = {};
          connections = [];
          isLoadingGroups = false;
          isLoadingConnections = false;
        } else {
          // API 控制模式
          api = new ClashAPI(activeConfig.host, activeConfig.port, activeConfig.secret);
        }
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

  function isCurrentApi(requestApi: ClashAPI, requestConfigId: string | null): boolean {
    return requestApi === api && requestConfigId === activeConfigId;
  }

  function clearLatencyState() {
    groupLatencyTestRuns.clear();
    nodeLatencyTestRuns.clear();
    testingLatencyGroups = new SvelteSet();
    testingLatencyNodes = new SvelteSet();
    failedTestGroups = new SvelteSet();
    failedTestNodes = new SvelteSet();
  }

  async function fetchVersion() {
    const requestApi = api;
    const requestConfigId = activeConfigId;
    if (!requestApi) return;

    try {
      const nextVersion = await requestApi.getVersion();
      if (isCurrentApi(requestApi, requestConfigId)) {
        version = nextVersion;
      }
    } catch (err) {
      if (isCurrentApi(requestApi, requestConfigId)) {
        apiError = 'Failed to connect to Clash';
      }
      console.error('Failed to fetch version:', err);
    }
  }

  async function fetchProxyPort() {
    const requestApi = api;
    const requestConfigId = activeConfigId;
    const requestProxyType = activeConfig?.proxyType ?? 'http';
    if (!requestApi) return;

    try {
      const config = await requestApi.getConfig();
      if (!isCurrentApi(requestApi, requestConfigId)) return;

      if (config['mixed-port']) {
        proxyPort = config['mixed-port'];
      } else if (requestProxyType === 'socks') {
        proxyPort = config['socks-port'] || config.port || null;
      } else {
        proxyPort = config.port || config['socks-port'] || null;
      }
    } catch (err) {
      console.error('Failed to fetch proxy port:', err);
    }
  }

  async function fetchProxyGroups() {
    const requestApi = api;
    const requestConfigId = activeConfigId;
    const requestConfigType = activeConfig?.configType;
    
    // 只有 API 类型才加载代理组
    if (!requestApi || requestConfigType !== 'api') {
      proxyGroups = [];
      allProxies = {};
      isLoadingGroups = false;
      return;
    }
    
    try {
      isLoadingGroups = true;
      const response = await requestApi.getProxies();
      if (!isCurrentApi(requestApi, requestConfigId)) return;

      const responseProxies = response.proxies || {};
      
      const groups: ProxyGroup[] = [];
      for (const [name, proxy] of Object.entries(responseProxies)) {
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
      
      const globalProxy = responseProxies['GLOBAL'];
      const sortIndex = globalProxy?.all ?? [];
      allProxies = responseProxies;
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
      if (isCurrentApi(requestApi, requestConfigId)) {
        isLoadingGroups = false;
      }
    }
  }

  async function fetchConnections() {
    const requestApi = api;
    const requestConfigId = activeConfigId;
    if (!requestApi) return;
    
    try {
      isLoadingConnections = true;
      const data = await requestApi.getConnections();
      if (isCurrentApi(requestApi, requestConfigId)) {
        connections = data.connections || [];
      }
    } catch (err) {
      console.error('Failed to fetch connections:', err);
    } finally {
      if (isCurrentApi(requestApi, requestConfigId)) {
        isLoadingConnections = false;
      }
    }
  }
  
  async function toggleProxy() {
    try {
      isTogglingProxy = true;
      const response = await chrome.runtime.sendMessage({ type: 'TOGGLE_PROXY' });
      if (response.success) {
        const state = await storage.getProxyEnabled();
        isProxyEnabled = state;
      }
    } catch (err) {
      console.error('Failed to toggle proxy:', err);
    } finally {
      isTogglingProxy = false;
    }
  }
  
  async function switchConfig(configId: string) {
    if (configId === activeConfigId) return;
    
    try {
      isLoadingGroups = true;
      isLoadingConnections = true;
      apiError = '';
      
      const wasProxyEnabled = isProxyEnabled;
      
      if (isProxyEnabled) {
        await chrome.runtime.sendMessage({ type: 'DISABLE_PROXY' });
      }
      
      proxyGroups = [];
      allProxies = {};
      connections = [];
      version = null;
      proxyPort = null;
      expandedGroups = new Set();
      clearLatencyState();
      
      await chrome.runtime.sendMessage({ 
        type: 'SWITCH_CONFIG', 
        payload: { configId } 
      });
      activeConfigId = configId;
      
      const config = configs.find(c => c.id === configId);
      if (!config) {
        throw new Error('Config not found');
      }
      
      // 纯代理模式处理
      if (config.configType === 'proxy-only') {
        // 设置代理端口为配置的 proxyPort
        proxyPort = config.proxyPort || null;
        
        const configIndex = configs.findIndex(c => c.id === configId);
        if (configIndex !== -1) {
          configs[configIndex].status = config.proxyPort && config.proxyPort > 0 ? 'available' : 'useless';
          configs = [...configs];
        }
        
        if (!config.proxyPort || config.proxyPort <= 0) {
          apiError = '纯代理模式未设置有效的代理端口';
          isLoadingGroups = false;
          isLoadingConnections = false;
          return;
        }
        
        // 纯代理模式不需要 API 连接
        api = null;
        isLoadingGroups = false;
        isLoadingConnections = false;
        
        if (wasProxyEnabled) {
          await chrome.runtime.sendMessage({ type: 'ENABLE_PROXY' });
        }
        return;
      }
      
      // API 控制模式处理
      api = new ClashAPI(config.host, config.port, config.secret);
      const requestApi = api;
      const isAvailable = await requestApi.healthCheck(3000);
      if (!isCurrentApi(requestApi, configId)) return;
      
      const configIndex = configs.findIndex(c => c.id === configId);
      if (configIndex !== -1) {
        configs[configIndex].status = isAvailable ? 'available' : 'unavailable';
        configs = [...configs];
      }
      
      if (!isAvailable) {
        apiError = '无法连接到新配置';
        isLoadingGroups = false;
        isLoadingConnections = false;
        return;
      }
      
      await fetchVersion();
      await fetchProxyGroups();
      await fetchConnections();
      
      if (wasProxyEnabled) {
        await chrome.runtime.sendMessage({ type: 'ENABLE_PROXY' });
      }
      
    } catch (err) {
      console.error('Failed to switch config:', err);
      apiError = '切换配置失败';
    } finally {
      isLoadingGroups = false;
      isLoadingConnections = false;
    }
  }
  
  async function switchProxyNode(groupName: string, nodeName: string) {
    const requestApi = api;
    const requestConfigId = activeConfigId;
    if (!requestApi) return;
    
    try {
      await requestApi.switchProxy(groupName, nodeName);
      if (!isCurrentApi(requestApi, requestConfigId)) return;

      expandedGroups.delete(groupName);
      expandedGroups = expandedGroups;
      await fetchProxyGroups();
    } catch (err) {
      console.error('Failed to switch proxy:', err);
    }
  }

  async function testGroupLatency(groupName: string) {
    const requestApi = api;
    const requestConfigId = activeConfigId;
    if (!requestApi || testingLatencyGroups.has(groupName)) return;
    const testRun = Symbol(groupName);
    groupLatencyTestRuns.set(groupName, testRun);
    
    try {
      testingLatencyGroups.add(groupName);
      failedTestGroups.delete(groupName);
      
      const result = await requestApi.testGroupDelay(groupName);
      if (!isCurrentApi(requestApi, requestConfigId) || groupLatencyTestRuns.get(groupName) !== testRun) {
        return;
      }
      
      const nextAllProxies = { ...allProxies };
      for (const [nodeName, delay] of Object.entries(result)) {
        if (nextAllProxies[nodeName]) {
          nextAllProxies[nodeName] = {
            ...nextAllProxies[nodeName],
            history: [...(nextAllProxies[nodeName].history || []), { time: new Date().toISOString(), delay }]
          };
        }
      }
      allProxies = nextAllProxies;
    } catch (err) {
      console.error('Failed to test group latency:', err);
      if (isCurrentApi(requestApi, requestConfigId) && groupLatencyTestRuns.get(groupName) === testRun) {
        failedTestGroups.add(groupName);
      }
    } finally {
      if (groupLatencyTestRuns.get(groupName) === testRun) {
        groupLatencyTestRuns.delete(groupName);
        testingLatencyGroups.delete(groupName);
      }
    }
  }

  async function testNodeLatency(nodeName: string) {
    const requestApi = api;
    const requestConfigId = activeConfigId;
    if (!requestApi || testingLatencyNodes.has(nodeName)) return;
    const testRun = Symbol(nodeName);
    nodeLatencyTestRuns.set(nodeName, testRun);
    
    try {
      testingLatencyNodes.add(nodeName);
      failedTestNodes.delete(nodeName);
      
      const result = await requestApi.testProxyDelay(nodeName);
      if (!isCurrentApi(requestApi, requestConfigId) || nodeLatencyTestRuns.get(nodeName) !== testRun) {
        return;
      }
      
      if (allProxies[nodeName]) {
        allProxies[nodeName] = {
          ...allProxies[nodeName],
          history: [...(allProxies[nodeName].history || []), { time: new Date().toISOString(), delay: result.delay }]
        };
        allProxies = allProxies;
      }
    } catch (err) {
      console.error('Failed to test node latency:', err);
      if (isCurrentApi(requestApi, requestConfigId) && nodeLatencyTestRuns.get(nodeName) === testRun) {
        failedTestNodes.add(nodeName);
      }
    } finally {
      if (nodeLatencyTestRuns.get(nodeName) === testRun) {
        nodeLatencyTestRuns.delete(nodeName);
        testingLatencyNodes.delete(nodeName);
      }
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
    if (activeConfig && activeConfig.configType === 'api') {
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

<div class="w-[420px] max-h-[550px] min-h-[380px] overflow-y-auto bg-[var(--color-bg)] text-[var(--color-text)] font-sans">
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
    
    <!-- 只有 API 类型才显示代理组 -->
    {#if activeConfig?.configType === 'api' && isProxyEnabled}
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
    {:else if activeConfig?.configType === 'proxy-only' && isProxyEnabled}
      <!-- 纯代理模式提示 -->
      <div class="px-3 py-4">
        <div class="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
          <div class="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <span class="text-base">ℹ️</span>
            <span>纯代理模式不支持节点切换和延迟测试</span>
          </div>
          <div class="mt-2 text-xs text-[var(--color-text-muted)]">
            要使用完整功能，请切换到 API 控制类型的配置
          </div>
        </div>
      </div>
    {/if}
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
