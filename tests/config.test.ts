import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { buildConfig } from '../src/config';

describe('buildConfig', () => {
  const originalEnv = { ...process.env };
  const originalStderr = console.error;

  beforeEach(() => {
    // Clear LLDAP environment variables
    delete process.env.LLDAP_CONFIG;
    delete process.env.LLDAP_HTTPURL;
    delete process.env.LLDAP_USERNAME;
    delete process.env.LLDAP_PASSWORD;
    delete process.env.LLDAP_TOKEN;
    delete process.env.LLDAP_REFRESHTOKEN;
    delete process.env.LLDAP_HTTPENDPOINT_AUTH;
    delete process.env.LLDAP_HTTPENDPOINT_GRAPH;
    delete process.env.LLDAP_HTTPENDPOINT_LOGOUT;
    delete process.env.LLDAP_HTTPENDPOINT_REFRESH;
    // Suppress warning output during tests
    console.error = () => {};
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    console.error = originalStderr;
  });

  test('throws error when no username provided and no token', () => {
    expect(() => buildConfig()).toThrow('Username is required');
  });

  test('returns config with token even without username', () => {
    const config = buildConfig({ token: 'test-token' });

    expect(config.httpUrl).toBe('http://localhost:17170');
    expect(config.username).toBe('');
    expect(config.token).toBe('test-token');
    expect(config.endpoints.auth).toBe('/auth/simple/login');
    expect(config.endpoints.graphql).toBe('/api/graphql');
  });

  test('environment variables override defaults', () => {
    process.env.LLDAP_HTTPURL = 'http://example.com:8080';
    process.env.LLDAP_USERNAME = 'testuser';
    process.env.LLDAP_PASSWORD = 'testpass';
    process.env.LLDAP_TOKEN = 'testtoken';
    process.env.LLDAP_REFRESHTOKEN = 'testrefresh';

    const config = buildConfig();

    expect(config.httpUrl).toBe('http://example.com:8080');
    expect(config.username).toBe('testuser');
    expect(config.password).toBe('testpass');
    expect(config.token).toBe('testtoken');
    expect(config.refreshToken).toBe('testrefresh');
  });

  test('CLI options override environment variables', () => {
    process.env.LLDAP_HTTPURL = 'http://env.com:8080';
    process.env.LLDAP_USERNAME = 'envuser';
    process.env.LLDAP_TOKEN = 'env-token';

    const config = buildConfig({
      httpUrl: 'http://cli.com:9090',
      username: 'cliuser',
    });

    expect(config.httpUrl).toBe('http://cli.com:9090');
    expect(config.username).toBe('cliuser');
  });

  test('custom endpoint environment variables are used', () => {
    process.env.LLDAP_HTTPENDPOINT_AUTH = '/custom/auth';
    process.env.LLDAP_HTTPENDPOINT_GRAPH = '/custom/graphql';
    process.env.LLDAP_TOKEN = 'test-token'; // Provide token to avoid username requirement

    const config = buildConfig();

    expect(config.endpoints.auth).toBe('/custom/auth');
    expect(config.endpoints.graphql).toBe('/custom/graphql');
  });

  test('warns about insecure HTTP connection to non-localhost', () => {
    let warningLogged = false;
    console.error = (msg: string) => {
      if (msg.includes('WARNING') && msg.includes('insecure HTTP')) {
        warningLogged = true;
      }
    };

    buildConfig({
      httpUrl: 'http://remote-server.com:17170',
      token: 'test-token',
    });

    expect(warningLogged).toBe(true);
  });

  test('does not warn about HTTP connection to localhost', () => {
    let warningLogged = false;
    console.error = (msg: string) => {
      if (msg.includes('WARNING') && msg.includes('insecure HTTP')) {
        warningLogged = true;
      }
    };

    buildConfig({
      httpUrl: 'http://localhost:17170',
      token: 'test-token',
    });

    expect(warningLogged).toBe(false);
  });
});
