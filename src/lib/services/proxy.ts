// Chrome Proxy Service
import type { ExtensionConfig, ProxyType } from '$lib/types';
import { DEFAULT_BYPASS_LIST } from '$lib/types';

export class ProxyService {
  /**
   * Enable Clash as Chrome's proxy using the given proxy port and bypass list.
   */
  static async enable(
    proxyHost: string,
    proxyPort: number,
    proxyType: ProxyType = 'http',
    bypassList?: string[],
  ): Promise<void> {
    const bypass = bypassList && bypassList.length > 0
      ? bypassList
      : DEFAULT_BYPASS_LIST;

    const chromeProxyType = proxyType === 'socks' ? 'socks5' : proxyType;

    const params = {
      value: {
        mode: 'fixed_servers',
        rules: {
          singleProxy: {
            scheme: chromeProxyType,
            host: proxyHost,
            port: proxyPort,
          },
          bypassList: bypass,
        },
      },
      scope: 'regular',
    } as const;

    console.log('[ProxyService.enable]', params);

    return new Promise((resolve, reject) => {
      chrome.proxy.settings.set(
        params,
        () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        },
      );
    });
  }

  /**
   * Disable proxy, revert to system settings.
   */
  static async disable(): Promise<void> {
    const params = {
      value: { mode: 'system' },
      scope: 'regular',
    } as const;

    console.log('[ProxyService.disable]', params);

    return new Promise((resolve, reject) => {
      chrome.proxy.settings.set(
        params,
        () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        },
      );
    });
  }

  /**
   * Get current proxy settings.
   */
  static async getCurrent(): Promise<unknown> {
    return new Promise((resolve) => {
      chrome.proxy.settings.get({}, (config: unknown) => {
        resolve(config);
      });
    });
  }

  /**
   * Determine the proxy port from Clash config.
   * Priority: mixed-port > port/socks-port (based on type)
   * Returns 0 if no suitable port found.
   */
  static getProxyPort(config: {
    'mixed-port'?: number;
    port?: number;
    'socks-port'?: number;
  }, proxyType: ProxyType = 'http'): number {
    if (config['mixed-port']) {
      return config['mixed-port'];
    }
    if (proxyType === 'socks') {
      return config['socks-port'] || config.port || 0;
    }
    return config.port || config['socks-port'] || 0;
  }

  /**
   * Check if config has any available port.
   */
  static hasAvailablePort(config: {
    'mixed-port'?: number;
    port?: number;
    'socks-port'?: number;
  }, proxyType: ProxyType = 'http'): boolean {
    return this.getProxyPort(config, proxyType) > 0;
  }
}
