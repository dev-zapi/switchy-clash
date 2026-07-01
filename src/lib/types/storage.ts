// Extension storage types

/**
 * Clash 配置类型
 * @since v2.0
 * - 'api': API 控制模式，通过 REST API 控制 Clash，自动获取代理端口（默认，保持 v1.x 行为）
 * - 'proxy-only': 仅代理模式，手动指定代理端口，无需 API 控制
 * 
 * 向后兼容性：v2.0 之前的配置默认为 'api' 类型，保持原有行为。
 */
export type ConfigType = 'api' | 'proxy-only';

export type ProxyType = 'http' | 'socks';

export interface ExtensionConfig {
  id: string;
  name: string;
  emoji: string;
  host: string;
  port: number;
  secret?: string;
  isDefault: boolean;
  lastUsed: number;
  status: 'unknown' | 'available' | 'unavailable' | 'useless';
  proxyType: ProxyType;
  /**
   * 配置类型
   * @since v2.0
   * - 'api': API 控制模式（默认，保持 v1.x 行为）
   * - 'proxy-only': 仅代理模式
   */
  configType: ConfigType;
  /**
   * 代理端口（仅 proxy-only 模式使用）
   * @since v2.0
   * - API 模式下此字段未定义，端口从 API 自动获取
   * - proxy-only 模式下必须指定，用于 Chrome 代理设置
   */
  proxyPort?: number;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export type FontFamily = 'system' | 'misans' | 'inter' | 'roboto' | 'noto-sans' | 'source-han-sans' | 'cascadia-code' | 'jetbrains-mono' | 'custom';

export interface ExtensionStorage {
  configs: ExtensionConfig[];
  activeConfigId: string | null;
  proxyEnabled: boolean;
  bypassList: string[];
  themeMode: ThemeMode;
  fontFamily: FontFamily;
  customFontFamily: string;
}

export const DEFAULT_BYPASS_LIST = [
  'localhost',
  '127.0.0.1',
  '*.local',
  '<local>',
];

/**
 * 默认配置对象
 * - configType: 'api' - 默认使用 API 模式，保持 v1.x 版本的行为兼容性
 * - proxyPort: undefined - API 模式下端口从 Clash API 动态获取，无需预设
 */
export const DEFAULT_CONFIG: ExtensionConfig = {
  id: '',
  name: '',
  emoji: '🏠',
  host: '127.0.0.1',
  port: 9090,
  secret: '',
  isDefault: true,
  lastUsed: 0,
  status: 'unknown',
  proxyType: 'http',
  configType: 'api',
  proxyPort: undefined,
};

export const DEFAULT_STORAGE: ExtensionStorage = {
  configs: [],
  activeConfigId: null,
  proxyEnabled: false,
  bypassList: [...DEFAULT_BYPASS_LIST],
  themeMode: 'system',
  fontFamily: 'misans',
  customFontFamily: '',
};
