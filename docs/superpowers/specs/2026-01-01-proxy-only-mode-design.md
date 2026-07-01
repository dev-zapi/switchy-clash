# 纯代理模式支持设计文档

**日期**: 2026-01-01  
**版本**: v2.0  
**状态**: 设计完成，待实现

---

## 功能概述

支持添加和配置没有开启 Clash REST API（9090 控制端口）的代理实例。这种"纯代理模式"的配置只能用于启用 Chrome 代理，不支持节点切换、延迟测试等需要 API 的功能。

---

## 需求背景

### 当前限制

当前实现假设所有 Clash 实例都有 REST API 端口（通常是 9090）：
- 配置中的 `port` 字段指的是 Clash REST API 端口
- 启用代理时，必须通过 API 获取 Clash 配置
- 从 Clash 配置中提取代理端口（mixed-port/port/socks-port）
- 如果 Clash 实例没有开启 API，整个流程会失败

### 用户场景

用户有 Clash 实例只监听代理端口（如 7890/7891），完全没有 REST API 控制端口：
- 无法添加这种配置到扩展
- 无法使用这种代理实例
- 必须开启 Clash API 才能使用扩展

### 解决方案

引入"配置类型"字段，区分两种工作模式：
- **API 控制模式**：通过 REST API 获取代理端口并控制代理（完整功能）
- **纯代理模式**：手动指定代理端口，仅用于启用 Chrome 代理（基础功能）

---

## 设计方案

### 方案选择

采用**方案 B：创建配置类型字段**：

- 添加 `configType: 'api' | 'proxy-only'` 字段
- `api` 类型：现有逻辑，通过 API 控制
- `proxy-only` 类型：纯代理模式，需要手动指定代理端口
- UI 上根据类型显示不同字段

**优点**：
- 语义清晰：类型明确区分两种配置用途
- UI 针对性强：每种类型只显示相关字段

**缺点**：
- 需要向后兼容处理：旧配置需要添加默认类型字段
- UI 需要类型选择器 + 条件字段显示

---

## 详细设计

### 1. 类型定义和数据结构

**文件**: `src/lib/types/storage.ts`

```typescript
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

---

### 2. UI 表单设计

**文件**: `src/options/App.svelte`

**表单字段调整**：
- 添加配置类型选择器（下拉框）
- 根据类型条件显示不同字段：
  - API 类型：显示 API 端口、Secret 字段
  - 纯代理类型：显示代理端口字段

**验证逻辑**：
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
    if (config.port < 1 || config.port > 65535) {
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

**测试连接逻辑**：
- API 类型：测试 API 连接（调用 `/version` 接口）
- 纯代理类型：显示提示信息，建议使用实际启用测试

---

### 3. 启用代理逻辑

**文件**: `src/background/index.ts`

**核心逻辑**：
```typescript
async function enableProxy(): Promise<{ success: boolean; error?: string }> {
  const config = await storage.getActiveConfig();
  if (!config) {
    return { success: false, error: 'No active configuration' };
  }

  const hasPermission = await hasHostPermission(config.host);
  if (!hasPermission) {
    return { success: false, error: `No permission to access ${config.host}` };
  }

  try {
    let proxyPort: number;
    
    if (config.configType === 'proxy-only') {
      // 纯代理模式：直接使用配置的代理端口
      if (!config.proxyPort || config.proxyPort <= 0) {
        await storage.updateConfig(config.id, { status: 'useless' });
        return { success: false, error: 'No proxy port specified' };
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
        return { success: false, error: 'No available proxy port' };
      }
      await storage.updateConfig(config.id, { status: 'available', lastUsed: Date.now() });
    }

    // 启用代理（统一逻辑）
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

**健康检查和自动切换逻辑**：
- 纯代理模式：检查 proxyPort 是否有效（无法真正测试端口可用性）
- API 控制模式：通过 API 健康检查并验证代理端口

---

### 4. Popup 显示逻辑

**文件**: `src/popup/App.svelte`

**配置卡片显示**：
- 显示配置类型标签（"API" 或 "纯代理"）
- 根据类型显示不同信息：
  - API 类型：`host:port`（API 端口）
  - 纯代理类型：`host:proxyPort`（代理端口）

**代理组显示**：
- API 类型：正常显示代理组、支持切换和延迟测试
- 纯代理类型：显示提示信息，说明不支持节点管理功能

**功能按钮调整**：
- 测试延迟按钮：纯代理类型禁用，显示提示信息

---

### 5. 向后兼容和数据迁移

**文件**: `src/lib/services/storage.ts`

**迁移策略**：
- 在读取时自动补全缺失字段，不修改原始存储数据
- 旧配置默认为 'api' 类型（保持原有行为）
- 确保所有配置都有完整的数据结构

**核心代码**（带详细注释）：
```typescript
/**
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
 */
async getConfigs(): Promise<ExtensionConfig[]> {
  const data = await this.get<ExtensionStorage>('storage');
  if (!data || !data.configs) return [];
  
  return data.configs.map(config => this.migrateConfig(config));
}

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

---

## 实现要点

### 关键改动文件

1. **类型定义**（`src/lib/types/storage.ts`）
   - 添加 `ConfigType` 类型
   - 更新 `ExtensionConfig` 接口
   - 更新 `DEFAULT_CONFIG`

2. **存储服务**（`src/lib/services/storage.ts`）
   - 实现配置迁移逻辑
   - 添加详细注释说明

3. **后台逻辑**（`src/background/index.ts`）
   - 修改 `enableProxy` 函数
   - 修改 `checkAllConfigs` 函数
   - 修改 `autoSwitch` 函数

4. **Options UI**（`src/options/App.svelte`）
   - 添加配置类型选择器
   - 条件显示字段
   - 更新验证逻辑

5. **Popup UI**（`src/popup/App.svelte`）
   - 显示配置类型标签
   - 条件显示代理组
   - 禁用不支持的功能

### 实现顺序

建议按以下顺序实现：
1. 类型定义（数据结构基础）
2. 存储服务迁移逻辑（数据兼容）
3. Options UI（配置创建/编辑）
4. 后台逻辑（核心功能）
5. Popup UI（显示和交互）

---

## 测试场景

### 功能测试

1. **创建纯代理配置**
   - 选择"纯代理"类型
   - 输入代理端口（如 7890）
   - 验证保存成功

2. **启用纯代理配置**
   - 切换到纯代理配置
   - 点击启用按钮
   - 验证 Chrome 代理设置正确

3. **API 配置保持正常**
   - 创建 API 类型配置
   - 启用并验证功能正常
   - 节点切换、延迟测试正常

4. **向后兼容测试**
   - 导入 v1.x 导出的配置
   - 验证自动迁移为 API 类型
   - 验证功能正常

### UI 测试

1. **表单验证**
   - 纯代理类型缺少代理端口：显示错误
   - API 类型缺少 API 端口：显示错误
   - 验证类型切换时字段清空

2. **Popup 显示**
   - 纯代理配置显示类型标签
   - 纯代理模式不显示代理组
   - 功能按钮正确禁用

---

## 未来扩展

### 可能的改进

1. **代理端口测试**
   - 实现简单的 TCP 连接测试
   - 或通过代理发送简单请求验证可用性

2. **混合模式**
   - 支持同时配置 API 和代理端口
   - API 失败时自动 fallback 到代理端口

3. **智能检测**
   - 自动检测常见代理端口（7890/7891/...）
   - 建议用户使用检测到的端口

---

## 参考文档

- [Clash API 文档](API.md)
- [Chrome Proxy API](CHROME_PROXY_API.md)
- [项目结构说明](README.md)