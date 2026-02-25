// Clash API types

export interface ClashVersion {
  premium: boolean;
  version: string;
  meta?: boolean;
}

export interface ClashConfig {
  port: number;
  'socks-port': number;
  'redir-port': number;
  'mixed-port': number;
  'allow-lan': boolean;
  mode: 'rule' | 'global' | 'direct';
  'log-level': string;
  ipv6: boolean;
  'external-controller': string;
  'external-ui'?: string;
}

export interface ProxyHistory {
  time: string;
  delay: number;
}

export interface ProxyNode {
  name: string;
  type: string;
  history: ProxyHistory[];
  now?: string;
  all?: string[];
  udp?: boolean;
  alive?: boolean;
}

export interface ProxiesResponse {
  proxies: Record<string, ProxyNode>;
}

export interface ProxyGroup {
  name: string;
  type: 'Selector' | 'URLTest' | 'LoadBalance' | 'Fallback' | 'Relay';
  now: string;
  all: string[];
  history: ProxyHistory[];
}

export interface Rule {
  type: string;
  payload: string;
  proxy: string;
}

export interface RulesResponse {
  rules: Rule[];
}

export interface Connection {
  id: string;
  metadata: {
    network: string;
    type: string;
    sourceIP: string;
    destinationIP: string;
    sourcePort: string;
    destinationPort: string;
    host: string;
  };
  upload: number;
  download: number;
  start: string;
  chains: string[];
  rule: string;
  rulePayload: string;
}

export interface ConnectionsResponse {
  downloadTotal: number;
  uploadTotal: number;
  connections: Connection[];
  memory?: { inuse: number; oslimit: number };
}

export interface DelayResult {
  delay: number;
}

export type ProxyGroupType = 'Selector' | 'URLTest' | 'LoadBalance' | 'Fallback' | 'Relay';

export const PROXY_GROUP_TYPES: ProxyGroupType[] = [
  'Selector',
  'URLTest',
  'LoadBalance',
  'Fallback',
];
