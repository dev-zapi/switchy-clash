// Chrome Storage Service
import type { ExtensionConfig, ExtensionStorage, ThemeMode } from '$lib/types';
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
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  // Configs
  async getConfigs(): Promise<ExtensionConfig[]> {
    const result = await this.get('configs');
    return Array.isArray(result) ? result : [];
  }

  async setConfigs(configs: ExtensionConfig[]): Promise<void> {
    return this.set('configs', configs);
  }

  async addConfig(config: ExtensionConfig): Promise<void> {
    const configs = await this.getConfigs();
    configs.push(config);
    await this.setConfigs(configs);
  }

  async updateConfig(id: string, updates: Partial<ExtensionConfig>): Promise<void> {
    const configs = await this.getConfigs();
    const idx = configs.findIndex((c) => c.id === id);
    if (idx !== -1) {
      configs[idx] = { ...configs[idx], ...updates };
      await this.setConfigs(configs);
    }
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

  // Listen for changes
  onChanged(
    callback: (changes: Record<string, chrome.storage.StorageChange>) => void,
  ): void {
    chrome.storage.onChanged.addListener((changes: Record<string, unknown>, areaName: string) => {
      if (areaName === 'local') {
        callback(changes as Record<string, chrome.storage.StorageChange>);
      }
    });
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
