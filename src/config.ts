import { readFileSync, existsSync } from 'fs';
import type { Config } from './types';

const DEFAULT_CONFIG: Config = {
  httpUrl: 'http://localhost:17170',
  // No default username - must be explicitly configured
  username: '',
  endpoints: {
    auth: '/auth/simple/login',
    graphql: '/api/graphql',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
  },
};

/**
 * Parse TOML-style config file for LLDAP settings
 */
function parseConfigFile(filePath: string): Partial<Config> {
  if (!existsSync(filePath)) {
    return {};
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const result: Partial<Config> = {};
    let currentSection = 'general';

    for (const line of content.split('\n')) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Section header
      const sectionMatch = trimmed.match(/^\[(\w+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        continue;
      }

      // Key-value pair
      const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
      if (kvMatch) {
        const [, key, rawValue] = kvMatch;
        const value = rawValue.replace(/^["']|["']$/g, '').trim();

        if (currentSection === 'general') {
          if (key === 'http_host') {
            const port = result.httpUrl?.match(/:(\d+)$/)?.[1] || '17170';
            result.httpUrl = `http://${value}:${port}`;
          } else if (key === 'http_port') {
            const host = result.httpUrl?.replace(/^http:\/\//, '').replace(/:\d+$/, '') || 'localhost';
            result.httpUrl = `http://${host}:${value}`;
          }
        } else if (currentSection === 'ldap') {
          if (key === 'ldap_user_dn') {
            result.username = value;
          } else if (key === 'ldap_user_pass') {
            result.password = value;
          }
        }
      }
    }

    return result;
  } catch {
    return {};
  }
}

/**
 * Build configuration from environment, file, and CLI options
 */
export function buildConfig(cliOptions: Partial<Config> = {}): Config {
  const configFile = cliOptions.configFile || process.env.LLDAP_CONFIG || '/etc/lldap.toml';
  const fileConfig = parseConfigFile(configFile);

  // Filter out undefined values from cliOptions to avoid overwriting defaults
  const filteredCliOptions = Object.fromEntries(
    Object.entries(cliOptions).filter(([, v]) => v !== undefined)
  ) as Partial<Config>;

  const config: Config = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...filteredCliOptions,
    endpoints: {
      auth: process.env.LLDAP_HTTPENDPOINT_AUTH || DEFAULT_CONFIG.endpoints.auth,
      graphql: process.env.LLDAP_HTTPENDPOINT_GRAPH || DEFAULT_CONFIG.endpoints.graphql,
      logout: process.env.LLDAP_HTTPENDPOINT_LOGOUT || DEFAULT_CONFIG.endpoints.logout,
      refresh: process.env.LLDAP_HTTPENDPOINT_REFRESH || DEFAULT_CONFIG.endpoints.refresh,
    },
  };

  // Environment variables override (support both naming conventions)
  if (process.env.LLDAP_HTTP_URL || process.env.LLDAP_HTTPURL) {
    config.httpUrl = process.env.LLDAP_HTTP_URL || process.env.LLDAP_HTTPURL || config.httpUrl;
  }
  if (process.env.LLDAP_USERNAME) config.username = process.env.LLDAP_USERNAME;
  if (process.env.LLDAP_PASSWORD) config.password = process.env.LLDAP_PASSWORD;
  if (process.env.LLDAP_TOKEN) config.token = process.env.LLDAP_TOKEN;
  if (process.env.LLDAP_REFRESH_TOKEN || process.env.LLDAP_REFRESHTOKEN) {
    config.refreshToken = process.env.LLDAP_REFRESH_TOKEN || process.env.LLDAP_REFRESHTOKEN;
  }

  // CLI options override environment
  if (cliOptions.httpUrl) config.httpUrl = cliOptions.httpUrl;
  if (cliOptions.username) config.username = cliOptions.username;
  if (cliOptions.password) config.password = cliOptions.password;
  if (cliOptions.token) config.token = cliOptions.token;
  if (cliOptions.refreshToken) config.refreshToken = cliOptions.refreshToken;

  // Validate required configuration
  if (!config.token && !config.refreshToken) {
    // Username required for login
    if (!config.username) {
      throw new Error('Username is required. Set via -D option, LLDAP_USERNAME env var, or config file.');
    }
  }

  // Warn about insecure HTTP connection
  if (config.httpUrl.startsWith('http://') && !config.httpUrl.includes('localhost') && !config.httpUrl.includes('127.0.0.1')) {
    console.error('WARNING: Using insecure HTTP connection to non-localhost server.');
    console.error('Consider using HTTPS for production environments.');
  }

  return config;
}
