// Background Service Worker
import { ClashAPI } from '$lib/services/clash-api';
import { storage } from '$lib/services/storage';
import { ProxyService } from '$lib/services/proxy';
import type { ExtensionConfig } from '$lib/types';

// Message types for communication
export interface MessageRequest {
  type: string;
  payload?: unknown;
}

export interface MessageResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

function getAPI(config: ExtensionConfig): ClashAPI {
  return new ClashAPI(config.host, config.port, config.secret);
}

// Set extension icon based on proxy state
async function updateIcon(enabled: boolean, error: boolean = false): Promise<void> {
  const suffix = enabled ? 'on' : 'off';
  const iconBase = `icons/icon-${suffix}`;
  try {
    await chrome.action.setIcon({
      path: {
        16: `${iconBase}-16.png`,
        32: `${iconBase}-32.png`,
        48: `${iconBase}-48.png`,
        128: `${iconBase}-128.png`,
      },
    });
    if (error) {
      await chrome.action.setBadgeText({ text: '!' });
      await chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    } else if (enabled) {
      await chrome.action.setBadgeText({ text: '' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch {
    // Icon files may not exist yet during development
  }
}

// Enable proxy with the active config
async function enableProxy(): Promise<{ success: boolean; error?: string }> {
  const config = await storage.getActiveConfig();
  if (!config) {
    return { success: false, error: 'No active configuration' };
  }

  try {
    const api = getAPI(config);
    const clashConfig = await api.getConfig();
    const proxyPort = ProxyService.getProxyPort(clashConfig);
    // Use the config host as the proxy host (the Clash instance host)
    await ProxyService.enable(config.host, proxyPort, config.bypassList);
    await storage.setProxyEnabled(true);
    await updateIcon(true);
    // Update config status
    await storage.updateConfig(config.id, {
      status: 'available',
      lastUsed: Date.now(),
    });
    return { success: true };
  } catch (e) {
    await storage.updateConfig(config.id, { status: 'unavailable' });
    await updateIcon(false, true);
    return { success: false, error: (e as Error).message };
  }
}

// Disable proxy
async function disableProxy(): Promise<{ success: boolean; error?: string }> {
  try {
    await ProxyService.disable();
    await storage.setProxyEnabled(false);
    await updateIcon(false);
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// Health check all configs
async function checkAllConfigs(): Promise<void> {
  const configs = await storage.getConfigs();
  for (const config of configs) {
    const api = getAPI(config);
    const available = await api.healthCheck();
    await storage.updateConfig(config.id, {
      status: available ? 'available' : 'unavailable',
    });
  }
}

// Auto-switch logic on startup
async function autoSwitch(): Promise<void> {
  const configs = await storage.getConfigs();
  if (configs.length === 0) return;

  const activeId = await storage.getActiveConfigId();

  // Priority 1: Check if active config is still available
  if (activeId) {
    const activeConfig = configs.find((c) => c.id === activeId);
    if (activeConfig) {
      const api = getAPI(activeConfig);
      const available = await api.healthCheck();
      if (available) {
        await storage.updateConfig(activeConfig.id, { status: 'available' });
        return; // Current config is fine
      }
      await storage.updateConfig(activeConfig.id, { status: 'unavailable' });
    }
  }

  // Priority 2: Try last used
  const sorted = [...configs].sort((a, b) => b.lastUsed - a.lastUsed);
  for (const config of sorted) {
    const api = getAPI(config);
    const available = await api.healthCheck();
    await storage.updateConfig(config.id, {
      status: available ? 'available' : 'unavailable',
    });
    if (available) {
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

// Handle messages from popup and options
chrome.runtime.onMessage.addListener(
  (
    request: MessageRequest,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void,
  ) => {
    const handler = async (): Promise<MessageResponse> => {
      try {
        switch (request.type) {
          case 'ENABLE_PROXY':
            return await enableProxy();

          case 'DISABLE_PROXY':
            return await disableProxy();

          case 'TOGGLE_PROXY': {
            const enabled = await storage.getProxyEnabled();
            return enabled ? await disableProxy() : await enableProxy();
          }

          case 'CHECK_ALL_CONFIGS':
            await checkAllConfigs();
            return { success: true };

          case 'GET_STATE': {
            const proxyEnabled = await storage.getProxyEnabled();
            const activeConfigId = await storage.getActiveConfigId();
            const configs = await storage.getConfigs();
            const themeMode = await storage.getThemeMode();
            return {
              success: true,
              data: { proxyEnabled, activeConfigId, configs, themeMode },
            };
          }

          case 'SWITCH_CONFIG': {
            const { configId } = request.payload as { configId: string };
            const wasEnabled = await storage.getProxyEnabled();
            if (wasEnabled) {
              await disableProxy();
            }
            await storage.setActiveConfigId(configId);
            await storage.updateConfig(configId, { lastUsed: Date.now() });
            if (wasEnabled) {
              return await enableProxy();
            }
            return { success: true };
          }

          default:
            return { success: false, error: `Unknown message type: ${request.type}` };
        }
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    };

    handler().then(sendResponse);
    return true; // Keep message channel open for async
  },
);

// Initialize on install/startup
chrome.runtime.onInstalled.addListener(async () => {
  const proxyEnabled = await storage.getProxyEnabled();
  await updateIcon(proxyEnabled);
  await autoSwitch();
});

chrome.runtime.onStartup.addListener(async () => {
  const proxyEnabled = await storage.getProxyEnabled();
  await updateIcon(proxyEnabled);
  await autoSwitch();
});
