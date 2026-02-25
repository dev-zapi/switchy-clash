// Extension storage types

export interface ExtensionConfig {
  id: string;
  name: string;
  emoji: string;
  host: string;
  port: number;
  secret?: string;
  bypassList?: string[];
  isDefault: boolean;
  lastUsed: number;
  status: 'unknown' | 'available' | 'unavailable';
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ExtensionStorage {
  configs: ExtensionConfig[];
  activeConfigId: string | null;
  proxyEnabled: boolean;
  themeMode: ThemeMode;
}

export const DEFAULT_BYPASS_LIST = [
  'localhost',
  '127.0.0.1',
  '*.local',
  '<local>',
];

export const DEFAULT_CONFIG: ExtensionConfig = {
  id: '',
  name: '',
  emoji: '🏠',
  host: '127.0.0.1',
  port: 9090,
  secret: '',
  bypassList: [...DEFAULT_BYPASS_LIST],
  isDefault: true,
  lastUsed: 0,
  status: 'unknown',
};

export const DEFAULT_STORAGE: ExtensionStorage = {
  configs: [],
  activeConfigId: null,
  proxyEnabled: false,
  themeMode: 'system',
};
