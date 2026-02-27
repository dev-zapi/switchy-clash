// Background Service Worker
import { ClashAPI } from '$lib/services/clash-api';
import { storage } from '$lib/services/storage';
import { ProxyService } from '$lib/services/proxy';
import { hasHostPermission } from '$lib/services/permissions';
import type { ExtensionConfig } from '$lib/types';
import { DEFAULT_BYPASS_LIST } from '$lib/types';

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

// Generate icon ImageData from an emoji character using OffscreenCanvas
function emojiToImageData(emoji: string, size: number): ImageData {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.font = `${Math.round(size * 0.75)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2);
  return ctx.getImageData(0, 0, size, size);
}

// Set extension icon based on proxy state
async function updateIcon(enabled: boolean, error: boolean = false, emoji?: string): Promise<void> {
  try {
    if (enabled && emoji) {
      // Use the config emoji as the icon when proxy is enabled
      const imageData: Record<string, ImageData> = {};
      for (const size of [16, 32, 48, 128]) {
        imageData[size.toString()] = emojiToImageData(emoji, size);
      }
      await chrome.action.setIcon({ imageData });
    } else {
      const suffix = enabled ? 'on' : 'off';
      const iconBase = `icons/icon-${suffix}`;
      await chrome.action.setIcon({
        path: {
          16: `${iconBase}-16.png`,
          32: `${iconBase}-32.png`,
          48: `${iconBase}-48.png`,
          128: `${iconBase}-128.png`,
        },
      });
    }
    if (error) {
      await chrome.action.setBadgeText({ text: '!' });
      await chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
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

  // Check host permission before connecting
  const hasPermission = await hasHostPermission(config.host);
  if (!hasPermission) {
    return { success: false, error: `No permission to access ${config.host}. Please grant access in the extension settings.` };
  }

  try {
    const api = getAPI(config);
    const clashConfig = await api.getConfig();
    const proxyPort = ProxyService.getProxyPort(clashConfig);
    // Dynamically add the Clash API host to bypass list so API traffic
    // is not routed through the proxy it controls
    const bypassList = [...(config.bypassList ?? DEFAULT_BYPASS_LIST)];
    if (!bypassList.includes(config.host)) {
      bypassList.push(config.host);
    }
    await ProxyService.enable(config.host, proxyPort, bypassList);
    await storage.setProxyEnabled(true);
    await updateIcon(true, false, config.emoji);
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
    if (activeConfig && await hasHostPermission(activeConfig.host)) {
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
    if (!(await hasHostPermission(config.host))) continue;
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
    _sender: any,
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
async function initIcon(): Promise<void> {
  const proxyEnabled = await storage.getProxyEnabled();
  if (proxyEnabled) {
    const config = await storage.getActiveConfig();
    await updateIcon(true, false, config?.emoji);
  } else {
    await updateIcon(false);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await initIcon();
  await autoSwitch();
});

chrome.runtime.onStartup.addListener(async () => {
  await initIcon();
  await autoSwitch();
});
