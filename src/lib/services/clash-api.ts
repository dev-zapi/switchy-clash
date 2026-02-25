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

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: { ...this.headers, ...options.headers as Record<string, string> },
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(error.message || `API error: ${res.status}`);
    }
    return res.json();
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
    );
  }

  async testGroupDelay(
    groupName: string,
    url: string = 'http://www.gstatic.com/generate_204',
    timeout: number = 5000,
  ): Promise<Record<string, number>> {
    return this.request<Record<string, number>>(
      `/group/${encodeURIComponent(groupName)}/delay?url=${encodeURIComponent(url)}&timeout=${timeout}`,
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
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), timeoutMs);
      await this.request<ClashVersion>('/version');
      clearTimeout(tid);
      return true;
    } catch {
      return false;
    }
  }
}
