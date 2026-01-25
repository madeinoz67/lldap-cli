import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { LldapClient } from '../src/client';
import type { Config } from '../src/types';
import { createMockFetch } from './test-utils';

// Mock fetch
const originalFetch = globalThis.fetch;

describe('LldapClient', () => {
  const mockConfig: Config = {
    httpUrl: 'http://localhost:17170',
    username: 'admin',
    password: 'password',
    endpoints: {
      auth: '/auth/simple/login',
      graphql: '/api/graphql',
      logout: '/auth/logout',
      refresh: '/auth/refresh',
    },
  };

  beforeEach(() => {
    // Reset fetch mock
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('constructor initializes with config', () => {
    const client = new LldapClient(mockConfig);
    expect(client).toBeDefined();
  });

  test('constructor uses provided token', () => {
    const configWithToken: Config = {
      ...mockConfig,
      token: 'existing-token',
    };
    const client = new LldapClient(configWithToken);
    expect(client.getToken()).toBe('existing-token');
  });

  test('login sends correct request', async () => {
    let requestUrl = '';
    let requestBody = '';

    globalThis.fetch = createMockFetch(async (url: string, options?: RequestInit) => {
      requestUrl = url;
      requestBody = options?.body as string;
      return new Response(JSON.stringify({
        token: 'new-token',
        refreshToken: 'new-refresh-token',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new LldapClient(mockConfig);
    const tokens = await client.login();

    expect(requestUrl).toBe('http://localhost:17170/auth/simple/login');
    expect(JSON.parse(requestBody)).toEqual({
      username: 'admin',
      password: 'password',
    });
    expect(tokens.token).toBe('new-token');
    expect(tokens.refreshToken).toBe('new-refresh-token');
  });

  test('login throws on error', async () => {
    globalThis.fetch = createMockFetch(async () => {
      return new Response('Invalid credentials', { status: 401 });
    });

    const client = new LldapClient(mockConfig);
    await expect(client.login()).rejects.toThrow('Login failed');
  });

  test('query sends GraphQL request with token', async () => {
    let requestHeaders: Record<string, string> = {};
    let requestBody = '';

    globalThis.fetch = createMockFetch(async (url: string, options?: RequestInit) => {
      if (url.includes('/auth/')) {
        return new Response(JSON.stringify({
          token: 'auth-token',
          refreshToken: 'refresh-token',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      requestHeaders = Object.fromEntries(
        Object.entries(options?.headers || {})
      ) as Record<string, string>;
      requestBody = options?.body as string;

      return new Response(JSON.stringify({
        data: { users: [] },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new LldapClient(mockConfig);
    const result = await client.query<{ users: unknown[] }>('{users{id}}');

    expect(requestHeaders['Authorization']).toBe('Bearer auth-token');
    expect(JSON.parse(requestBody)).toEqual({
      query: '{users{id}}',
      variables: {},
    });
    expect(result.users).toEqual([]);
  });

  test('query handles GraphQL errors', async () => {
    globalThis.fetch = createMockFetch(async (url: string) => {
      if (url.includes('/auth/')) {
        return new Response(JSON.stringify({
          token: 'auth-token',
          refreshToken: 'refresh-token',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        errors: [{ message: 'User not found' }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new LldapClient(mockConfig);
    await expect(client.query('{user(id:"test"){id}}')).rejects.toThrow('GraphQL error: User not found');
  });

  test('refresh uses refresh token', async () => {
    let requestHeaders: Record<string, string> = {};

    globalThis.fetch = createMockFetch(async (_url: string, options?: RequestInit) => {
      requestHeaders = Object.fromEntries(
        Object.entries(options?.headers || {})
      ) as Record<string, string>;

      return new Response(JSON.stringify({
        token: 'refreshed-token',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const configWithRefresh: Config = {
      ...mockConfig,
      refreshToken: 'existing-refresh-token',
    };
    const client = new LldapClient(configWithRefresh);
    const newToken = await client.refresh();

    expect(requestHeaders['Cookie']).toBe('refresh_token=existing-refresh-token');
    expect(newToken).toBe('refreshed-token');
  });

  test('refresh throws without refresh token', async () => {
    const client = new LldapClient(mockConfig);
    await expect(client.refresh()).rejects.toThrow('Refresh token is required');
  });
});
