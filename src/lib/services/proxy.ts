// Chrome Proxy Service
import type { ExtensionConfig } from '$lib/types';
import { DEFAULT_BYPASS_LIST } from '$lib/types';

export class ProxyService {
  /**
   * Enable Clash as Chrome's proxy using the given proxy port and bypass list.
   */
  static async enable(
    proxyHost: string,
    proxyPort: number,
    bypassList?: string[],
  ): Promise<void> {
    const bypass = bypassList && bypassList.length > 0
      ? bypassList
      : DEFAULT_BYPASS_LIST;

    return new Promise((resolve, reject) => {
      chrome.proxy.settings.set(
        {
          value: {
            mode: 'fixed_servers',
            rules: {
              singleProxy: {
                scheme: 'http',
                host: proxyHost,
                port: proxyPort,
              },
              bypassList: bypass,
            },
          },
          scope: 'regular',
        },
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
    return new Promise((resolve, reject) => {
      chrome.proxy.settings.set(
        {
          value: { mode: 'system' },
          scope: 'regular',
        },
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
   * Priority: mixed-port > port > socks-port
   */
  static getProxyPort(config: {
    'mixed-port'?: number;
    port?: number;
    'socks-port'?: number;
  }): number {
    return config['mixed-port'] || config.port || config['socks-port'] || 7890;
  }
}
