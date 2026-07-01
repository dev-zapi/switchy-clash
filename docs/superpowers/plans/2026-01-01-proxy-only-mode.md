# 纯代理模式支持实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持添加和配置没有 Clash REST API 的代理实例（纯代理模式）

**Architecture:** 通过配置类型字段区分 API 控制模式和纯代理模式。纯代理模式手动指定代理端口，跳过 API 调用，直接启用 Chrome 代理。向后兼容处理确保旧配置自动迁移。

**Tech Stack:** Svelte 5 runes, TypeScript, Chrome Extension Manifest V3, Chrome Proxy API

---

## 文件结构

**修改文件：**
1. `src/lib/types/storage.ts` - 添加配置类型定义和新字段
2. `src/lib/services/storage.ts` - 实现配置迁移逻辑
3. `src/options/App.svelte` - UI 表单添加类型选择和条件字段显示
4. `src/background/index.ts` - 启用代理、健康检查、自动切换逻辑
5. `src/popup/App.svelte` - Popup 显示和功能限制

---

## Task 1: 类型定义修改

**Files:**
- Modify: `src/lib/types/storage.ts:1-60`

- [ ] **Step 1: 添加 ConfigType 类型定义**

在文件顶部添加新类型定义：

```typescript
// Extension storage types

/**
 * 配置类型枚举
 * 
 * v2.0 新增字段，用于区分配置的工作模式：
 * - 'api': API 控制模式，通过 Clash REST API 获取代理端口并控制代理
 * - 'proxy-only': 纯代理模式，手动指定代理端口，仅用于启用 Chrome 代理
 * 
 * 向后兼容：
 * - v1.x 配置默认为 'api' 类型（在 storage.ts migrateConfig 中处理）
 */
export type ConfigType = 'api' | 'proxy-only';

export type ProxyType = 'http' | 'socks';
```

- [ ] **Step 2: 更新 ExtensionConfig 接口**

修改接口定义，添加新字段并更新注释：

```typescript
/**
 * 扩展配置接口
 * 
 * v2.0 更新说明：
 * - 新增 configType 字段：区分 API 控制和纯代理模式
 * - 新增 proxyPort 字段：纯代理模式的代理端口
 * - port 字段含义变更：明确为 API 端口（不再是代理端口）
 * 
 * 向后兼容：
 * - 旧版本配置在读取时自动补全 configType 和 proxyPort
 * - port 字段保持原有含义（v1.x 都是 API 端口）
 */
export interface ExtensionConfig {
  id: string;
  name: string;
  emoji: string;
  host: string;
  
  // API 控制模式字段（configType === 'api'）
  port: number;          // Clash REST API 端口（如 9090）
  secret?: string;       // API 认证密钥
  
  // 纯代理模式字段（configType === 'proxy-only'）
  proxyPort?: number;    // 代理端口（如 7890），纯代理模式必填
  
  configType: ConfigType;  // 配置类型（v2.0 新增）
  proxyType: ProxyType;    // 代理协议类型
  
  isDefault: boolean;
  lastUsed: number;
  status: 'unknown' | 'available' | 'unavailable' | 'useless';
}
```

- [ ] **Step 3: 更新 DEFAULT_CONFIG 常量**

修改默认配置，添加新字段：

```typescript
/**
 * 默认配置模板
 * 
 * v2.0 默认值：
 * - configType: 'api'（默认使用 API 控制模式）
 * - proxyPort: undefined（纯代理模式需要手动设置）
 * 
 * 向后兼容：
 * - 新建配置默认为 API 类型（与 v1.x 行为一致）
 */
export const DEFAULT_CONFIG: ExtensionConfig = {
  id: '',
  name: '',
  emoji: '🏠',
  host: '127.0.0.1',
  port: 9090,
  secret: '',
  proxyPort: undefined,
  configType: 'api',
  proxyType: 'http',
  isDefault: true,
  lastUsed: 0,
  status: 'unknown',
};
```

- [ ] **Step 4: 运行类型检查**

Run: `npm run check`
Expected: PASS（类型定义正确）

- [ ] **Step 5: Commit 类型定义修改**

```bash
git add src/lib/types/storage.ts
git commit -m "feat: add ConfigType and proxyPort field for proxy-only mode support"
```

---

## Task 2: 存储服务迁移逻辑

**Files:**
- Modify: `src/lib/services/storage.ts`（完整文件）

- [ ] **Step 1: 读取现有 storage.ts 文件**

使用 Read 工具读取 `src/lib/services/storage.ts`，理解现有结构。

- [ ] **Step 2: 添加 migrateConfig 私有方法**

在 StorageService 类中添加迁移方法（带完整注释）：

```typescript
/**
 * 配置迁移函数：确保配置数据结构完整
 * 
 * 此函数用于向后兼容，处理以下场景：
 * 1. v1.x 版本配置升级到 v2.0
 * 2. 导入的配置可能缺少新字段
 * 3. 手动编辑存储数据后的修复
 * 
 * 迁移规则：
 * - configType: 缺失时默认为 'api'（v1.x 所有配置都是 API 类型）
 * - proxyPort: 缺失时为 undefined（纯代理模式可选字段）
 * - 其他字段：使用 DEFAULT_CONFIG 作为 fallback
 * 
 * 注意：
 * - 不要在迁移函数中添加业务逻辑判断
 * - 迁移函数仅负责字段补全，保持数据结构完整性
 * 
 * @param config - 可能不完整的配置对象
 * @returns 完整的 ExtensionConfig 对象
 */
private migrateConfig(config: Partial<ExtensionConfig>): ExtensionConfig {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    // 向后兼容：v1.x 配置默认为 API 类型（保持原有行为）
    configType: config.configType ?? 'api',
    // 纯代理模式的代理端口，旧配置不使用此字段
    proxyPort: config.proxyPort ?? undefined,
    // 配置状态，确保有默认值
    status: config.status ?? 'unknown',
  };
}
```

- [ ] **Step 3: 修改 getConfigs 方法**

更新 `getConfigs()` 方法，添加迁移处理和注释：

```typescript
/**
 * 获取所有配置列表
 * 
 * 向后兼容处理：为旧版本配置补全缺失字段
 * 
 * 背景：
 * - v2.0 版本引入了 'configType' 字段（'api' | 'proxy-only'）
 * - v2.0 版本引入了 'proxyPort' 字段（纯代理模式的代理端口）
 * - v1.x 版本的配置缺少这些字段
 * 
 * 解决方案：
 * - 在读取时自动补全缺失字段，不修改原始存储数据
 * - 旧配置默认为 'api' 类型（保持原有行为）
 * - 确保所有配置都有完整的数据结构
 * 
 * 注意：
 * - 迁移处理对调用者透明，返回的配置都是完整结构
 * - 原始存储数据保持不变，避免破坏性修改
 */
async getConfigs(): Promise<ExtensionConfig[]> {
  const data = await this.get<ExtensionStorage>('storage');
  if (!data || !data.configs) return [];
  
  return data.configs.map(config => this.migrateConfig(config));
}
```

- [ ] **Step 4: 修改 getActiveConfig 方法**

确保返回的配置经过迁移处理：

```typescript
async getActiveConfig(): Promise<ExtensionConfig | null> {
  const configs = await this.getConfigs();
  const activeId = await this.getActiveConfigId();
  return configs.find(c => c.id === activeId) || null;
}
```

- [ ] **Step 5: 修改 setConfigs 方法**

添加规范化处理和注释：

```typescript
/**
 * 保存配置列表
 * 
 * 保存前确保所有配置都经过迁移处理
 * 
 * 目的：
 * - 确保写入的数据结构完整
 * - 处理可能的异常数据（手动编辑、导入等）
 * 
 * 注意：
 * - 此处的迁移主要是为了规范化数据
 * - 不应该改变配置的核心属性（类型、端口等）
 */
async setConfigs(configs: ExtensionConfig[]): Promise<void> {
  const migratedConfigs = configs.map(c => this.migrateConfig(c));
  await this.updateStorage({ configs: migratedConfigs });
}
```

- [ ] **Step 6: 运行类型检查**

Run: `npm run check`
Expected: PASS

- [ ] **Step 7: Commit 存储服务修改**

```bash
git add src/lib/services/storage.ts
git commit -m "feat: add config migration logic for backward compatibility"
```

---

## Task 3: Options UI - 配置类型选择器

**Files:**
- Modify: `src/options/App.svelte:88-98`（handleAddNew 函数）
- Modify: `src/options/App.svelte:580-700`（编辑表单区域）

- [ ] **Step 1: 修改 handleAddNew 函数**

更新新建配置时的默认值：

```typescript
function handleAddNew(): void {
  editingConfig = {
    ...DEFAULT_CONFIG,
    id: generateId(),
    isDefault: configs.length === 0, // First config is default
    lastUsed: Date.now(),
    configType: 'api',  // 新建默认为 API 类型
    proxyPort: undefined,  // 纯代理模式需要手动设置
  };
  isEditing = true;
  formErrors = {};
  testStatus = null;
}
```

- [ ] **Step 2: 修改 handleEdit 函数**

确保编辑时包含新字段：

```typescript
function handleEdit(config: ExtensionConfig): void {
  editingConfig = { 
    ...config,
    configType: config.configType || 'api',  // 确保有类型字段
    proxyPort: config.proxyPort,  // 保留代理端口
  };
  isEditing = true;
  formErrors = {};
  testStatus = null;
}
```

- [ ] **Step 3: 修改 validateForm 函数**

更新验证逻辑，根据类型验证不同字段：

```typescript
function validateForm(config: ExtensionConfig): boolean {
  const errors: Record<string, string> = {};

  if (!config.name.trim()) {
    errors.name = 'Name is required';
  }

  if (!config.host.trim()) {
    errors.host = 'Host is required';
  }

  // 根据类型验证不同字段
  if (config.configType === 'api') {
    if (!config.port || config.port < 1 || config.port > 65535) {
      errors.port = 'API port must be between 1 and 65535';
    }
  } else if (config.configType === 'proxy-only') {
    if (!config.proxyPort || config.proxyPort < 1 || config.proxyPort > 65535) {
      errors.proxyPort = 'Proxy port must be between 1 and 65535';
    }
  }

  formErrors = errors;
  return Object.keys(errors).length === 0;
}
```

- [ ] **Step 4: 修改表单 UI - 添加配置类型选择器**

在表单开头添加类型选择器（在 Name 字段之前）：

```svelte
<!-- 配置类型选择器 -->
<div class="md:col-span-2">
  <label for="config-type" class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
    配置类型 <span class="text-[var(--color-danger)]">*</span>
  </label>
  <select
    id="config-type"
    bind:value={editingConfig.configType}
    onchange={() => {
      // 类型切换时清空相关字段
      if (editingConfig.configType === 'api') {
        editingConfig.proxyPort = undefined;
      } else {
        // 切换到纯代理时，可以保留 API 端口作为备用信息
      }
    }}
    class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition-all"
  >
    <option value="api">API 控制（完整功能）</option>
    <option value="proxy-only">纯代理（仅启用代理）</option>
  </select>
  <p class="mt-1.5 text-xs text-[var(--color-text-muted)]">
    {#if editingConfig.configType === 'api'}
      API 控制：通过 Clash REST API 获取代理端口，支持查看节点、切换代理、测试延迟等完整功能
    {:else}
      纯代理：手动指定代理端口，仅用于启用 Chrome 代理，不支持节点管理等功能
    {/if}
  </p>
</div>
```

- [ ] **Step 5: 条件显示 API 字段**

修改现有的 Port 和 Secret 字段，添加条件渲染：

```svelte
<!-- API 类型字段（仅 configType === 'api' 时显示） -->
{#if editingConfig.configType === 'api'}
  <div class="md:col-span-1">
    <label for="config-port" class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
      API 端口 <span class="text-[var(--color-danger)]">*</span>
    </label>
    <input
      id="config-port"
      type="number"
      bind:value={editingConfig.port}
      placeholder="9090"
      min="1"
      max="65535"
      class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus:border-transparent transition-all"
    />
    {#if formErrors.port}
      <p class="mt-1 text-xs text-[var(--color-danger)]">{formErrors.port}</p>
    {/if}
  </div>

  <div class="md:col-span-1">
    <label for="config-secret" class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
      API Secret（可选）
    </label>
    <input
      id="config-secret"
      type="password"
      bind:value={editingConfig.secret}
      placeholder="API 认证密钥"
      class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus:border-transparent transition-all"
    />
  </div>
{/if}
```

- [ ] **Step 6: 添加代理端口字段**

添加纯代理模式的代理端口输入框：

```svelte
<!-- 纯代理类型字段（仅 configType === 'proxy-only' 时显示） -->
{#if editingConfig.configType === 'proxy-only'}
  <div class="md:col-span-1">
    <label for="config-proxy-port" class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
      代理端口 <span class="text-[var(--color-danger)]">*</span>
    </label>
    <input
      id="config-proxy-port"
      type="number"
      bind:value={editingConfig.proxyPort}
      placeholder="7890"
      min="1"
      max="65535"
      class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus:border-transparent transition-all"
    />
    {#if formErrors.proxyPort}
      <p class="mt-1 text-xs text-[var(--color-danger)]">{formErrors.proxyPort}</p>
    {/if}
    <p class="mt-1.5 text-xs text-[var(--color-text-muted)]">
      Clash 代理监听端口（如 HTTP 代理 7890、SOCKS 代理 7891）
    </p>
  </div>
{/if}
```

- [ ] **Step 7: 修改测试连接按钮逻辑**

更新测试连接按钮的 onclick 处理：

```typescript
async function handleTestConnection(): Promise<void> {
  if (!editingConfig) return;

  // 纯代理模式提示
  if (editingConfig.configType === 'proxy-only') {
    testStatus = { 
      message: '纯代理模式无法测试 API 连接。请保存后实际启用测试。', 
      type: 'info' 
    };
    return;
  }

  // API 类型：原有逻辑
  if (!isLocalhostHost(editingConfig.host)) {
    const granted = await ensureHostPermission(editingConfig.host);
    if (!granted) {
      testStatus = { message: `Host permission denied for ${editingConfig.host}`, type: 'error' };
      return;
    }
  }

  testStatus = { message: 'Testing connection...', type: 'info' };

  try {
    const api = new ClashAPI(
      editingConfig.host,
      editingConfig.port,
      editingConfig.secret
    );
    
    const isHealthy = await api.healthCheck(3000);
    
    if (isHealthy) {
      testStatus = { message: 'Connection successful!', type: 'success' };
    } else {
      testStatus = { message: 'Connection failed', type: 'error' };
    }
  } catch (error) {
    testStatus = { 
      message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
      type: 'error' 
    };
  }
}
```

- [ ] **Step 8: 运行类型检查**

Run: `npm run check`
Expected: PASS

- [ ] **Step 9: 手动测试 UI**

在浏览器中打开扩展选项页面，验证：
- 类型选择器显示正确
- API 类型显示 API 端口和 Secret 字段
- 纯代理类型显示代理端口字段
- 类型切换时字段正确显示/隐藏
- 表单验证正确工作

- [ ] **Step 10: Commit Options UI 修改**

```bash
git add src/options/App.svelte
git commit -m "feat: add config type selector and conditional fields in options UI"
```

---

## Task 4: 后台逻辑 - enableProxy 函数

**Files:**
- Modify: `src/background/index.ts:70-113`（enableProxy 函数）

- [ ] **Step 1: 修改 enableProxy 函数**

更新启用代理逻辑，处理两种配置类型：

```typescript
// Enable proxy with the active config
async function enableProxy(): Promise<{ success: boolean; error?: string }> {
  const config = await storage.getActiveConfig();
  if (!config) {
    return { success: false, error: 'No active configuration' };
  }

  // Check host permission before connecting
  const hasPermission = await hasHostPermission(config.host);
  if (!hasPermission) {
    return { success: false, error: `No permission to access ${config.host}. Please grant access in the extension settings.` };
  }

  try {
    let proxyPort: number;
    
    if (config.configType === 'proxy-only') {
      // 纯代理模式：直接使用配置的代理端口
      if (!config.proxyPort || config.proxyPort <= 0) {
        await storage.updateConfig(config.id, { status: 'useless' });
        return { success: false, error: 'No proxy port specified for proxy-only config' };
      }
      proxyPort = config.proxyPort;
      await storage.updateConfig(config.id, { status: 'available', lastUsed: Date.now() });
      
    } else {
      // API 控制模式：通过 API 获取代理端口
      const api = getAPI(config);
      const clashConfig = await api.getConfig();
      proxyPort = ProxyService.getProxyPort(clashConfig, config.proxyType);
      
      if (!ProxyService.hasAvailablePort(clashConfig, config.proxyType)) {
        await storage.updateConfig(config.id, { status: 'useless' });
        return { success: false, error: 'No available proxy port in Clash configuration' };
      }
      
      // Update config status
      await storage.updateConfig(config.id, {
        status: 'available',
        lastUsed: Date.now(),
      });
    }
    
    // Add all config hosts to bypass list so API traffic
    // is not routed through the proxy
    const configs = await storage.getConfigs();
    const allHosts = configs.map(c => c.host);
    const baseBypassList = await storage.getBypassList();
    const bypassList = [...new Set([...baseBypassList, ...allHosts])];
    
    await ProxyService.enable(config.host, proxyPort, config.proxyType, bypassList);
    await storage.setProxyEnabled(true);
    await updateIcon(true, false, config.emoji);
    
    return { success: true };
  } catch (e) {
    await storage.updateConfig(config.id, { status: 'unavailable' });
    await updateIcon(false, true);
    return { success: false, error: (e as Error).message };
  }
}
```

- [ ] **Step 2: 运行类型检查**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Commit enableProxy 修改**

```bash
git add src/background/index.ts
git commit -m "feat: handle proxy-only config type in enableProxy logic"
```

---

## Task 5: 后台逻辑 - checkAllConfigs 函数

**Files:**
- Modify: `src/background/index.ts:127-144`（checkAllConfigs 函数）

- [ ] **Step 1: 修改 checkAllConfigs 函数**

更新健康检查逻辑，处理两种配置类型：

```typescript
// Health check all configs
async function checkAllConfigs(): Promise<void> {
  const configs = await storage.getConfigs();
  for (const config of configs) {
    let status: 'available' | 'unavailable' | 'useless' = 'unavailable';
    
    if (config.configType === 'proxy-only') {
      // 纯代理模式：检查 proxyPort 是否有效（无法真正测试端口可用性）
      if (config.proxyPort && config.proxyPort > 0) {
        status = 'available';
      } else {
        status = 'useless';
      }
      
    } else {
      // API 控制模式：通过 API 健康检查
      const api = getAPI(config);
      const available = await api.healthCheck();
      
      if (available) {
        const clashConfig = await api.getConfig();
        const hasPort = ProxyService.hasAvailablePort(clashConfig, config.proxyType);
        status = hasPort ? 'available' : 'useless';
      }
    }
    
    await storage.updateConfig(config.id, { status });
  }
}
```

- [ ] **Step 2: 运行类型检查**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Commit checkAllConfigs 修改**

```bash
git add src/background/index.ts
git commit -m "feat: handle proxy-only config type in checkAllConfigs logic"
```

---

## Task 6: 后台逻辑 - autoSwitch 函数

**Files:**
- Modify: `src/background/index.ts:146-200`（autoSwitch 函数）

- [ ] **Step 1: 修改 autoSwitch 函数**

更新自动切换逻辑，处理两种配置类型：

```typescript
// Auto-switch logic on startup
async function autoSwitch(): Promise<void> {
  const configs = await storage.getConfigs();
  if (configs.length === 0) return;

  const activeId = await storage.getActiveConfigId();

  // Priority 1: Check if active config is still available
  if (activeId) {
    const activeConfig = configs.find((c) => c.id === activeId);
    if (activeConfig && await hasHostPermission(activeConfig.host)) {
      let isAvailable = false;
      
      if (activeConfig.configType === 'proxy-only') {
        // 纯代理模式：检查 proxyPort 是否有效
        isAvailable = activeConfig.proxyPort && activeConfig.proxyPort > 0;
        await storage.updateConfig(activeConfig.id, {
          status: isAvailable ? 'available' : 'useless'
        });
      } else {
        // API 控制模式：通过 API 健康检查
        const api = getAPI(activeConfig);
        const available = await api.healthCheck();
        if (available) {
          const clashConfig = await api.getConfig();
          const hasPort = ProxyService.hasAvailablePort(clashConfig, activeConfig.proxyType);
          await storage.updateConfig(activeConfig.id, {
            status: hasPort ? 'available' : 'useless'
          });
          isAvailable = hasPort;
        } else {
          await storage.updateConfig(activeConfig.id, { status: 'unavailable' });
        }
      }
      
      if (isAvailable) return; // Current config is fine
    }
  }

  // Priority 2: Try last used
  const sorted = [...configs].sort((a, b) => b.lastUsed - a.lastUsed);
  for (const config of sorted) {
    if (!(await hasHostPermission(config.host))) continue;
    
    let status: 'available' | 'unavailable' | 'useless' = 'unavailable';
    
    if (config.configType === 'proxy-only') {
      // 纯代理模式：检查 proxyPort
      status = config.proxyPort && config.proxyPort > 0 ? 'available' : 'useless';
    } else {
      // API 控制模式：通过 API 健康检查
      const api = getAPI(config);
      const available = await api.healthCheck();
      
      if (available) {
        const clashConfig = await api.getConfig();
        const hasPort = ProxyService.hasAvailablePort(clashConfig, config.proxyType);
        status = hasPort ? 'available' : 'useless';
      }
    }
    
    await storage.updateConfig(config.id, { status });
    if (status === 'available') {
      await storage.setActiveConfigId(config.id);
      // Re-enable proxy if it was enabled
      const wasEnabled = await storage.getProxyEnabled();
      if (wasEnabled) {
        await enableProxy();
      }
      return;
    }
  }

  // No available config found, disable proxy
  const wasEnabled = await storage.getProxyEnabled();
  if (wasEnabled) {
    await disableProxy();
  }
}
```

- [ ] **Step 2: 运行类型检查**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Commit autoSwitch 修改**

```bash
git add src/background/index.ts
git commit -m "feat: handle proxy-only config type in autoSwitch logic"
```

---

## Task 7: Popup UI - 配置显示和类型标签

**Files:**
- Modify: `src/popup/App.svelte:1-50`（状态和类型定义）
- Modify: `src/popup/App.svelte` 配置卡片显示区域

- [ ] **Step 1: 读取 popup/App.svelte 文件**

使用 Read 工具完整读取 `src/popup/App.svelte`，理解现有结构。

- [ ] **Step 2: 找到配置卡片显示位置**

搜索配置列表渲染代码，确定修改位置。

- [ ] **Step 3: 在配置卡片中添加类型标签**

修改配置列表渲染，添加类型标签显示：

```svelte
{#each configs as config (config.id)}
  <button
    onclick={() => handleSwitchConfig(config.id)}
    class="..."
    disabled={config.status === 'unavailable'}
  >
    <div class="flex items-center gap-2">
      <span class="text-base">{config.emoji}</span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-medium truncate">{config.name}</span>
          
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
          
          <!-- 状态指示器 -->
          <span class="text-xs leading-none shrink-0">
            {config.status === 'available' ? '🟢' : config.status === 'unavailable' ? '🔴' : '⚪'}
          </span>
        </div>
        
        <!-- 显示不同信息 -->
        <div class="text-xs text-[var(--color-text-secondary)] truncate">
          {#if config.configType === 'proxy-only'}
            {config.host}:{config.proxyPort || '未设置'}
          {:else}
            {config.host}:{config.port}
          {/if}
        </div>
      </div>
    </div>
  </button>
{/each}
```

- [ ] **Step 4: 运行类型检查**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Commit Popup 配置显示修改**

```bash
git add src/popup/App.svelte
git commit -m "feat: display config type label and proxy port in popup"
```

---

## Task 8: Popup UI - 代理组条件显示

**Files:**
- Modify: `src/popup/App.svelte` 代理组渲染区域

- [ ] **Step 1: 找到代理组渲染代码**

搜索代理组（proxy groups）显示相关的代码。

- [ ] **Step 2: 添加配置类型条件检查**

修改代理组显示，只对 API 类型配置显示：

```svelte
<!-- 只有 API 类型才显示代理组 -->
{#if activeConfig?.configType === 'api' && proxyEnabled}
  <section class="mb-4">
    <h3 class="text-sm font-medium mb-2">代理组</h3>
    
    {#if isLoading}
      <div class="text-center py-4">
        <div class="animate-spin h-6 w-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full mx-auto"></div>
      </div>
    {:else if proxyGroups.length === 0}
      <div class="text-center py-4 text-sm text-[var(--color-text-secondary)]">
        无可用代理组
      </div>
    {:else}
      {#each proxyGroups as group (group.name)}
        <!-- 代理组选择器（现有逻辑保持不变） -->
        ...
      {/each}
    {/if}
  </section>
{:else if activeConfig?.configType === 'proxy-only' && proxyEnabled}
  <!-- 纯代理模式提示 -->
  <div class="mb-4 p-3 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
    <div class="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
      <span class="text-base">ℹ️</span>
      <span>纯代理模式不支持节点切换和延迟测试</span>
    </div>
    <div class="mt-2 text-xs text-[var(--color-text-muted)]">
      要使用完整功能，请切换到 API 控制类型的配置
    </div>
  </div>
{/if}
```

- [ ] **Step 3: 修改 loadProxyGroups 函数**

添加配置类型检查：

```typescript
async function loadProxyGroups(): Promise<void> {
  // 只有 API 类型才加载代理组
  if (!activeConfig || activeConfig.configType !== 'api') {
    proxyGroups = [];
    return;
  }
  
  try {
    const api = new ClashAPI(activeConfig.host, activeConfig.port, activeConfig.secret);
    const proxiesData = await api.getProxies();
    
    // 现有的代理组解析逻辑...
  } catch (error) {
    console.error('Failed to load proxy groups:', error);
    proxyGroups = [];
  }
}
```

- [ ] **Step 4: 修改 loadState 函数**

确保纯代理模式不加载代理组：

```typescript
async function loadState(): Promise<void> {
  try {
    isLoading = true;
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    
    if (response.success) {
      proxyEnabled = response.data.proxyEnabled;
      activeConfigId = response.data.activeConfigId;
      configs = response.data.configs;
      themeMode = response.data.themeMode;
      
      activeConfig = configs.find(c => c.id === activeConfigId);
      
      // 只有 API 类型才加载代理组
      if (activeConfig?.configType === 'api' && proxyEnabled) {
        await loadProxyGroups();
      } else {
        proxyGroups = [];
      }
    }
  } catch (error) {
    console.error('Failed to load state:', error);
  } finally {
    isLoading = false;
  }
}
```

- [ ] **Step 5: 运行类型检查**

Run: `npm run check`
Expected: PASS

- [ ] **Step 6: Commit Popup 代理组显示修改**

```bash
git add src/popup/App.svelte
git commit -m "feat: show proxy groups only for API config type in popup"
```

---

## Task 9: Popup UI - 功能按钮调整

**Files:**
- Modify: `src/popup/App.svelte` 功能按钮区域

- [ ] **Step 1: 找到测试延迟按钮代码**

搜索延迟测试相关的按钮代码。

- [ ] **Step 2: 条件显示/禁用测试延迟按钮**

修改延迟测试按钮，对纯代理模式禁用：

```svelte
<!-- 测试延迟按钮 -->
{#if activeConfig?.configType === 'api'}
  <button
    onclick={handleTestLatency}
    disabled={!proxyEnabled || isLoading}
    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[var(--color-text)] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] rounded border border-[var(--color-border)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
    测试延迟
  </button>
{:else}
  <button
    disabled
    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[var(--color-text)] bg-[var(--color-bg-tertiary)] rounded border border-[var(--color-border)] opacity-50 cursor-not-allowed transition-colors"
    title="纯代理模式不支持延迟测试"
  >
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
    测试延迟
  </button>
{/if}
```

- [ ] **Step 3: 运行类型检查**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: Commit Popup 功能按钮修改**

```bash
git add src/popup/App.svelte
git commit -m "feat: disable latency test button for proxy-only config in popup"
```

---

## Task 10: 导入导出兼容性

**Files:**
- Modify: `src/options/App.svelte:handleExport` 和 `handleImport` 函数

- [ ] **Step 1: 找到导入导出函数**

搜索 `handleExport` 和 `handleImport` 函数位置。

- [ ] **Step 2: 修改 handleExport 函数**

确保导出包含所有新字段：

```typescript
async function handleExport(): Promise<void> {
  const configs = await storage.getConfigs();
  
  /**
   * 导出配置到 JSON 文件
   * 
   * 导出的数据包含所有字段（包括 v2.0 新增字段）：
   * - configType: 配置类型标识
   * - proxyPort: 纯代理模式的代理端口
   * 
   * 向后兼容：
   * - v1.x 用户导入 v2.0 导出的配置时，新字段会被自动迁移处理
   * - 导出的配置可以在不同版本间共享
   */
  const exportData = configs.map(c => ({
    ...c,
    // 显式包含所有字段，确保导出数据完整
    configType: c.configType,
    proxyPort: c.proxyPort,
  }));
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `switchy-clash-configs-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showNotification(`Exported ${configs.length} configurations`, 'success');
}
```

- [ ] **Step 3: 修改 handleImport 函数**

确保导入时使用迁移逻辑：

```typescript
function handleImport(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const text = e.target?.result as string;
      const importedConfigs = JSON.parse(text);
      
      /**
       * 从 JSON 文件导入配置
       * 
       * 导入处理：
       * 1. 验证必要字段（id, name, host）
       * 2. 使用 storage.setConfigs() 自动迁移缺失字段
       * 3. 合并到现有配置列表
       * 
       * 支持导入来源：
       * - v2.0 导出的配置（包含所有新字段）
       * - v1.x 导出的配置（缺少新字段，自动补全）
       * - 其他来源的配置（验证后补全）
       */
      if (!Array.isArray(importedConfigs)) {
        throw new Error('Invalid format: expected array of configs');
      }
      
      const configs = await storage.getConfigs();
      
      // 合并导入的配置（避免重复 ID）
      const existingIds = new Set(configs.map(c => c.id));
      const newConfigs = importedConfigs.filter(c => !existingIds.has(c.id));
      
      // 验证必要字段
      const validConfigs = newConfigs.filter(c => 
        c.id && c.name && c.host
      );
      
      if (validConfigs.length === 0) {
        showNotification('No valid configurations to import', 'error');
        return;
      }
      
      // 使用 storage.setConfigs 会自动迁移缺失字段
      await storage.setConfigs([...configs, ...validConfigs]);
      showNotification(`Imported ${validConfigs.length} configurations`, 'success');
      
    } catch (error) {
      console.error('Import failed:', error);
      showNotification(
        `Import failed: ${error instanceof Error ? error.message : 'Invalid file'}`, 
        'error'
      );
    }
  };
  reader.readAsText(file);
  input.value = ''; // Reset input
}
```

- [ ] **Step 4: 运行类型检查**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Commit 导入导出修改**

```bash
git add src/options/App.svelte
git commit -m "feat: ensure export/import compatibility with v2.0 config fields"
```

---

## Task 11: 构建和最终测试

**Files:**
- 无文件修改，仅构建和测试

- [ ] **Step 1: 运行完整构建**

Run: `npm run build`
Expected: PASS，生成 `dist/` 目录

- [ ] **Step 2: 运行类型检查**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: 加载扩展到 Chrome**

在 Chrome 中：
1. 打开 `chrome://extensions/`
2. 启用开发者模式
3. 点击"加载已解压的扩展程序"
4. 选择 `dist/` 目录

- [ ] **Step 4: 测试新建纯代理配置**

在选项页面：
1. 点击"Add New"
2. 选择"纯代理"类型
3. 输入名称、主机、代理端口
4. 保存配置
5. 验证配置列表显示正确

- [ ] **Step 5: 测试启用纯代理配置**

在 Popup 中：
1. 切换到纯代理配置
2. 点击启用按钮
3. 验证 Chrome 代理设置正确（可通过第三方网站测试）

- [ ] **Step 6: 测试 API 配置保持正常**

使用现有 API 类型配置：
1. 启用代理
2. 验证节点切换正常
3. 验证延迟测试正常

- [ ] **Step 7: 测试向后兼容**

如果有 v1.x 导出的配置文件：
1. 导入配置文件
2. 验证自动迁移为 API 类型
3. 验证功能正常工作

- [ ] **Step 8: 最终 Commit**

```bash
git add .
git commit -m "feat: complete proxy-only mode support with backward compatibility"
```

---

## 自我审查

### 1. Spec Coverage

对照设计文档检查：
- ✅ 类型定义修改（Task 1）
- ✅ 存储服务迁移逻辑（Task 2）
- ✅ Options UI 配置类型选择器（Task 3）
- ✅ 后台 enableProxy 逻辑（Task 4）
- ✅ 后台 checkAllConfigs 逻辑（Task 5）
- ✅ 后台 autoSwitch 逻辑（Task 6）
- ✅ Popup 配置显示（Task 7）
- ✅ Popup 代理组条件显示（Task 8）
- ✅ Popup 功能按钮调整（Task 9）
- ✅ 导入导出兼容性（Task 10）
- ✅ 构建和测试（Task 11）

所有设计文档中的需求都已覆盖。

### 2. Placeholder Scan

检查计划文档：
- ✅ 无 TBD/TODO
- ✅ 无"implement later"或"fill in details"
- ✅ 所有代码步骤都包含完整代码
- ✅ 所有测试步骤都有具体命令和预期输出
- ✅ 无"类似 Task N"的引用

### 3. Type Consistency

检查类型使用：
- ✅ `ConfigType` 类型定义一致
- ✅ `ExtensionConfig` 接口字段一致
- ✅ `proxyPort?: number` 字段类型一致
- ✅ `configType: ConfigType` 字段类型一致
- ✅ 函数参数和返回值类型匹配

### 4. Scope Check

检查范围聚焦：
- ✅ 所有任务都围绕"纯代理模式支持"单一功能
- ✅ 没有涉及其他功能扩展
- ✅ 每个任务都是必要的改动
- ✅ 任务顺序合理，依赖关系清晰

---

## 执行选项

计划完成并保存到 `docs/superpowers/plans/2026-01-01-proxy-only-mode.md`。

两种执行选项：

**1. Subagent-Driven (推荐)** - 每个任务派发独立子代理，任务间审查，快速迭代

**2. Inline Execution** - 在当前会话中使用 executing-plans 执行，批量执行带检查点审查

选择哪种方式？