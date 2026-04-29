// Clash API Client Service
import type {
  ClashVersion,
  ClashConfig,
  ProxiesResponse,
  ProxyNode,
  RulesResponse,
  ConnectionsResponse,
  DelayResult,
} from '$lib/types';

export class ClashAPI {
  private baseUrl: string;
  private secret: string;
  private static readonly DEFAULT_TIMEOUT_MS = 10000;

  constructor(host: string, port: number, secret: string = '') {
    this.baseUrl = `http://${host}:${port}`;
    this.secret = secret;
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.secret) {
      h['Authorization'] = `Bearer ${this.secret}`;
    }
    return h;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
    timeoutMs: number = ClashAPI.DEFAULT_TIMEOUT_MS,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        headers: { ...this.headers, ...options.headers as Record<string, string> },
        signal: controller.signal,
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(error.message || `API error: ${res.status}`);
      }
      // Some endpoints (PUT/DELETE) return 204 No Content with empty body
      if (res.status === 204 || res.headers.get('content-length') === '0') {
        return undefined as T;
      }
      const text = await res.text();
      if (!text) return undefined as T;
      return JSON.parse(text);
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`Request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // System Info
  async getVersion(): Promise<ClashVersion> {
    return this.request<ClashVersion>('/version');
  }

  // Configuration
  async getConfig(): Promise<ClashConfig> {
    return this.request<ClashConfig>('/configs');
  }

  async patchConfig(patch: Partial<ClashConfig>): Promise<void> {
    await this.request('/configs', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  // Proxies
  async getProxies(): Promise<ProxiesResponse> {
    return this.request<ProxiesResponse>('/proxies');
  }

  async getProxy(name: string): Promise<ProxyNode> {
    return this.request<ProxyNode>(`/proxies/${encodeURIComponent(name)}`);
  }

  async switchProxy(groupName: string, proxyName: string): Promise<void> {
    await this.request(`/proxies/${encodeURIComponent(groupName)}`, {
      method: 'PUT',
      body: JSON.stringify({ name: proxyName }),
    });
  }

  // Delay Testing
  async testProxyDelay(
    name: string,
    url: string = 'http://www.gstatic.com/generate_204',
    timeout: number = 5000,
  ): Promise<DelayResult> {
    return this.request<DelayResult>(
      `/proxies/${encodeURIComponent(name)}/delay?url=${encodeURIComponent(url)}&timeout=${timeout}`,
      {},
      timeout + 2000,
    );
  }

  async testGroupDelay(
    groupName: string,
    url: string = 'http://www.gstatic.com/generate_204',
    timeout: number = 5000,
  ): Promise<Record<string, number>> {
    return this.request<Record<string, number>>(
      `/group/${encodeURIComponent(groupName)}/delay?url=${encodeURIComponent(url)}&timeout=${timeout}`,
      {},
      timeout + 2000,
    );
  }

  // Rules
  async getRules(): Promise<RulesResponse> {
    return this.request<RulesResponse>('/rules');
  }

  // Connections
  async getConnections(): Promise<ConnectionsResponse> {
    return this.request<ConnectionsResponse>('/connections');
  }

  async closeAllConnections(): Promise<void> {
    await this.request('/connections', { method: 'DELETE' });
  }

  async closeConnection(id: string): Promise<void> {
    await this.request(`/connections/${id}`, { method: 'DELETE' });
  }

  // Health Check (light)
  async healthCheck(timeoutMs: number = 3000): Promise<boolean> {
    try {
      await this.request<ClashVersion>('/version', {}, timeoutMs);
      return true;
    } catch {
      return false;
    }
  }
}
