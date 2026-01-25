import { mock } from 'bun:test';

/**
 * Create a mock fetch function that can be assigned to globalThis.fetch
 */
export function createMockFetch(handler: (url: string, options?: RequestInit) => Promise<Response>) {
  const mockFn = mock(handler) as unknown as typeof fetch;
  return mockFn;
}

/**
 * Setup a mock fetch that returns a JSON response
 */
export function mockFetchJson(responseData: unknown) {
  return createMockFetch(async () => {
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

/**
 * Create a non-expiring test JWT token
 * The token has an expiration date far in the future (year 2099)
 */
export function createTestToken(): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: 'test-user',
    iat: Math.floor(Date.now() / 1000),
    exp: 4102444800, // Jan 1, 2100
  }));
  const signature = btoa('test-signature');
  return `${header}.${payload}.${signature}`;
}
