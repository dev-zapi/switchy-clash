// Chrome Storage Service
import type { ExtensionConfig, ExtensionStorage, ThemeMode, FontFamily } from '$lib/types';
import { DEFAULT_STORAGE } from '$lib/types';

class StorageService {
  private async get<K extends keyof ExtensionStorage>(
    key: K,
  ): Promise<ExtensionStorage[K]> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(key, (result: Record<string, unknown>) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve((result[key] as ExtensionStorage[K]) ?? DEFAULT_STORAGE[key]);
      });
    });
  }

  private async set<K extends keyof ExtensionStorage>(
    key: K,
    value: ExtensionStorage[K],
  ): Promise<void> {
    // Deep-clone to strip Svelte 5 $state Proxy wrappers.
    // chrome.storage.local.set() uses structured clone internally,
    // which may serialize Proxy-wrapped arrays as plain objects.
    const plainValue = JSON.parse(JSON.stringify(value));
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: plainValue }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * 迁移单个配置对象以支持向后兼容性
   * 
   * 背景：v2.0 引入了 configType 和 proxyPort 字段，v1.x 的配置缺少这些字段。
   * 
   * 迁移规则：
   * - configType 缺失时默认为 'api'（保持 v1.x 行为）
   * - proxyPort 缺失时默认为 undefined（API 模式下自动获取端口）
   * 
   * 注意：此方法仅填充缺失字段，不执行业务逻辑。
   * 迁移发生在读取时，不修改存储中的原始数据。
   * 
   * @param config - 从存储读取的配置对象（可能缺少新字段）
   * @returns 完整的配置对象，包含所有必需字段
   */
  private migrateConfig(config: ExtensionConfig): ExtensionConfig {
    return {
      ...config,
      configType: config.configType ?? 'api',
      proxyPort: config.proxyPort ?? undefined,
    };
  }

  // Configs
  /**
   * 获取所有配置
   * 
   * 背景：v2.0 引入了 configType 和 proxyPort 字段。
   * 解决方案：读取时自动填充缺失字段，不修改存储中的原始数据。
   * 
   * 调用者始终获得完整的配置对象，迁移过程对调用者透明。
   * 
   * @returns 迁移后的完整配置数组
   */
  async getConfigs(): Promise<ExtensionConfig[]> {
    const result = await this.get('configs');
    const configs = Array.isArray(result) ? result : [];
    // 应用迁移逻辑，确保所有配置都包含 v2.0 新字段
    return configs.map(config => this.migrateConfig(config));
  }

  /**
   * 保存配置列表
   * 
   * 在保存前对每个配置应用迁移逻辑，确保：
   * 1. 新字段有默认值（防止 undefined 传播）
   * 2. 数据完整性约束
   * 
   * @param configs - 要保存的配置数组
   */
  async setConfigs(configs: ExtensionConfig[]): Promise<void> {
    // 保存前规范化配置，确保所有字段都有有效值
    const normalizedConfigs = configs.map(config => this.migrateConfig(config));
    return this.set('configs', normalizedConfigs);
  }

  async addConfig(config: ExtensionConfig): Promise<void> {
    const configs = await this.getConfigs();
    configs.push(config);
    await this.setConfigs(configs);
  }

  async updateConfig(id: string, updates: Partial<ExtensionConfig>): Promise<boolean> {
    const configs = await this.getConfigs();
    const idx = configs.findIndex((c) => c.id === id);
    if (idx === -1) {
      return false;
    }
    configs[idx] = { ...configs[idx], ...updates };
    await this.setConfigs(configs);
    return true;
  }

  async deleteConfig(id: string): Promise<void> {
    let configs = await this.getConfigs();
    configs = configs.filter((c) => c.id !== id);
    await this.setConfigs(configs);
  }

  async getConfigById(id: string): Promise<ExtensionConfig | undefined> {
    const configs = await this.getConfigs();
    return configs.find((c) => c.id === id);
  }

  // Active Config
  async getActiveConfigId(): Promise<string | null> {
    return this.get('activeConfigId');
  }

  async setActiveConfigId(id: string | null): Promise<void> {
    return this.set('activeConfigId', id);
  }

  async getActiveConfig(): Promise<ExtensionConfig | undefined> {
    const id = await this.getActiveConfigId();
    if (!id) return undefined;
    return this.getConfigById(id);
  }

  // Proxy State
  async getProxyEnabled(): Promise<boolean> {
    return this.get('proxyEnabled');
  }

  async setProxyEnabled(enabled: boolean): Promise<void> {
    return this.set('proxyEnabled', enabled);
  }

  // Theme
  async getThemeMode(): Promise<ThemeMode> {
    return this.get('themeMode');
  }

  async setThemeMode(mode: ThemeMode): Promise<void> {
    return this.set('themeMode', mode);
  }

  // Font Family
  async getFontFamily(): Promise<FontFamily> {
    return this.get('fontFamily');
  }

  async setFontFamily(font: FontFamily): Promise<void> {
    return this.set('fontFamily', font);
  }

  async getCustomFontFamily(): Promise<string> {
    return this.get('customFontFamily');
  }

  async setCustomFontFamily(font: string): Promise<void> {
    return this.set('customFontFamily', font);
  }

  // Bypass List
  async getBypassList(): Promise<string[]> {
    return this.get('bypassList');
  }

  async setBypassList(bypassList: string[]): Promise<void> {
    return this.set('bypassList', bypassList);
  }

  // Listen for changes
  onChanged(
    callback: (changes: Record<string, chrome.storage.StorageChange>) => void,
  ): () => void {
    const listener = (changes: Record<string, unknown>, areaName: string) => {
      if (areaName === 'local') {
        callback(changes as Record<string, chrome.storage.StorageChange>);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }
}

// Extend chrome.storage namespace for TypeScript
declare namespace chrome.storage {
  interface StorageChange {
    oldValue?: unknown;
    newValue?: unknown;
  }
}

export const storage = new StorageService();
