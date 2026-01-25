import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { LldapClient } from '../src/client';
import { UserService } from '../src/users';
import type { Config } from '../src/types';
import { createMockFetch, createTestToken } from './test-utils';

const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;

describe('Security Features', () => {
  const mockConfig: Config = {
    httpUrl: 'http://localhost:17170',
    username: 'admin',
    token: createTestToken(),
    endpoints: {
      auth: '/auth/simple/login',
      graphql: '/api/graphql',
      logout: '/auth/logout',
      refresh: '/auth/refresh',
    },
  };

  beforeEach(() => {
    globalThis.fetch = originalFetch;
    console.error = () => {}; // Suppress audit logs during tests
    LldapClient.setDebugEnabled(false);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    LldapClient.setDebugEnabled(false);
  });

  describe('Input Validation', () => {
    test('setPassword rejects weak passwords', async () => {
      globalThis.fetch = createMockFetch(async () => {
        return new Response(JSON.stringify({ data: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = new LldapClient(mockConfig);
      const userService = new UserService(client);

      // Too short
      await expect(
        userService.setPassword('testuser', 'short', 'http://localhost:17170', createTestToken())
      ).rejects.toThrow('too short');
    });

    test('setPassword rejects passwords without complexity', async () => {
      globalThis.fetch = createMockFetch(async () => {
        return new Response(JSON.stringify({ data: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = new LldapClient(mockConfig);
      const userService = new UserService(client);

      // No numbers
      await expect(
        userService.setPassword('testuser', 'onlyletters', 'http://localhost:17170', createTestToken())
      ).rejects.toThrow('must contain');

      // No letters
      await expect(
        userService.setPassword('testuser', '12345678', 'http://localhost:17170', createTestToken())
      ).rejects.toThrow('must contain');
    });

    test('setPassword rejects passwords that are too long', async () => {
      globalThis.fetch = createMockFetch(async () => {
        return new Response(JSON.stringify({ data: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = new LldapClient(mockConfig);
      const userService = new UserService(client);

      const longPassword = 'a'.repeat(130) + '1';
      await expect(
        userService.setPassword('testuser', longPassword, 'http://localhost:17170', createTestToken())
      ).rejects.toThrow('too long');
    });

    test('setPassword rejects userId with dangerous characters', async () => {
      globalThis.fetch = createMockFetch(async () => {
        return new Response(JSON.stringify({ data: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = new LldapClient(mockConfig);
      const userService = new UserService(client);

      // Shell injection attempts
      await expect(
        userService.setPassword('user;rm -rf /', 'ValidPass1', 'http://localhost:17170', createTestToken())
      ).rejects.toThrow('dangerous characters');

      await expect(
        userService.setPassword('user|cat /etc/passwd', 'ValidPass1', 'http://localhost:17170', createTestToken())
      ).rejects.toThrow('dangerous characters');

      await expect(
        userService.setPassword('user$(whoami)', 'ValidPass1', 'http://localhost:17170', createTestToken())
      ).rejects.toThrow('dangerous characters');
    });

    test('setPassword rejects empty userId', async () => {
      globalThis.fetch = createMockFetch(async () => {
        return new Response(JSON.stringify({ data: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = new LldapClient(mockConfig);
      const userService = new UserService(client);

      await expect(
        userService.setPassword('', 'ValidPass1', 'http://localhost:17170', createTestToken())
      ).rejects.toThrow('cannot be empty');

      await expect(
        userService.setPassword('   ', 'ValidPass1', 'http://localhost:17170', createTestToken())
      ).rejects.toThrow('cannot be empty');
    });

    test('email validation resists ReDoS attacks (CWE-1333)', () => {
      const client = new LldapClient(mockConfig);

      // Craft malicious input that would cause polynomial backtracking
      // with the old regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      // Attack string: starts with '!@!.' followed by '!.' repetitions
      // Keep under 254 chars to bypass length check and test actual validation
      const maliciousEmail = '!@!.' + '!.'.repeat(100); // 204 chars

      const startTime = performance.now();

      // Should reject quickly (< 100ms) rather than hanging
      expect(() => {
        client.validateEmail(maliciousEmail);
      }).toThrow('Invalid email format');

      const elapsed = performance.now() - startTime;

      // If the old vulnerable regex was used, this would take longer
      // The fix should complete in milliseconds
      expect(elapsed).toBeLessThan(100);
    }, 1000); // 1 second timeout - fails fast if ReDoS vulnerability exists

    test('email validation length check prevents large ReDoS payloads', () => {
      const client = new LldapClient(mockConfig);

      // Even larger payloads are blocked by length validation first
      const largePayload = '!@!.' + '!.'.repeat(50000);

      expect(() => {
        client.validateEmail(largePayload);
      }).toThrow('exceeds maximum length');
    });

    test('email validation accepts valid emails', () => {
      const client = new LldapClient(mockConfig);

      // These should not throw
      expect(() => client.validateEmail('user@example.com')).not.toThrow();
      expect(() => client.validateEmail('user.name@example.co.uk')).not.toThrow();
      expect(() => client.validateEmail('user+tag@example.org')).not.toThrow();
    });

    test('email validation rejects invalid emails', () => {
      const client = new LldapClient(mockConfig);

      // Missing @
      expect(() => client.validateEmail('userexample.com')).toThrow('Invalid email format');
      // Missing domain
      expect(() => client.validateEmail('user@')).toThrow('Invalid email format');
      // Missing local part
      expect(() => client.validateEmail('@example.com')).toThrow('Invalid email format');
      // No dot in domain
      expect(() => client.validateEmail('user@localhost')).toThrow('Invalid email format');
      // Domain starts with dot
      expect(() => client.validateEmail('user@.example.com')).toThrow('Invalid email format');
      // Domain ends with dot
      expect(() => client.validateEmail('user@example.')).toThrow('Invalid email format');
      // Contains whitespace
      expect(() => client.validateEmail('user @example.com')).toThrow('Invalid email format');
    });
  });

  describe('Token Expiration', () => {
    test('isTokenExpired returns true for expired token', () => {
      // Create a token that expired in the past
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({
        sub: 'test-user',
        iat: 1000000000,
        exp: 1000000001, // Expired long ago
      }));
      const signature = btoa('test-signature');
      const expiredToken = `${header}.${payload}.${signature}`;

      const config: Config = {
        ...mockConfig,
        token: expiredToken,
      };

      // Client will try to refresh/login when token is expired
      let loginAttempted = false;
      globalThis.fetch = createMockFetch(async (url) => {
        if (url.includes('/auth/simple/login')) {
          loginAttempted = true;
          return new Response(JSON.stringify({
            token: createTestToken(),
            refreshToken: createTestToken(),
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ data: { users: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = new LldapClient({ ...config, password: 'testpass' });
      const userService = new UserService(client);

      // This should trigger a re-authentication because token is expired
      userService.getUsers().then(() => {
        expect(loginAttempted).toBe(true);
      });
    });

    test('valid token does not trigger re-authentication', async () => {
      let loginAttempted = false;
      globalThis.fetch = createMockFetch(async (url) => {
        if (url.includes('/auth/simple/login')) {
          loginAttempted = true;
        }
        return new Response(JSON.stringify({ data: { users: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = new LldapClient(mockConfig);
      const userService = new UserService(client);

      await userService.getUsers();
      expect(loginAttempted).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    test('handles 429 rate limit with retry', async () => {
      let requestCount = 0;
      globalThis.fetch = createMockFetch(async () => {
        requestCount++;
        if (requestCount === 1) {
          return new Response('Rate limited', { status: 429 });
        }
        return new Response(JSON.stringify({ data: { users: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = new LldapClient(mockConfig);
      const userService = new UserService(client);

      await userService.getUsers();
      expect(requestCount).toBe(2);
    });

    test('throws after max retries', async () => {
      globalThis.fetch = createMockFetch(async () => {
        return new Response('Rate limited', { status: 429 });
      });

      const client = new LldapClient(mockConfig);
      const userService = new UserService(client);

      await expect(userService.getUsers()).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Error Sanitization', () => {
    test('sanitizes token from error messages', async () => {
      globalThis.fetch = createMockFetch(async () => {
        return new Response('Error with token=secretToken123 exposed', { status: 500 });
      });

      const client = new LldapClient(mockConfig);
      const userService = new UserService(client);

      try {
        await userService.getUsers();
      } catch (error) {
        expect((error as Error).message).not.toContain('secretToken123');
        expect((error as Error).message).toContain('[REDACTED]');
      }
    });
  });

  describe('Input Length Validation', () => {
    test('rejects username exceeding max length', () => {
      const client = new LldapClient(mockConfig);
      const longUsername = 'a'.repeat(100);

      expect(() => client.validateUsername(longUsername)).toThrow('exceeds maximum length');
    });

    test('rejects email exceeding max length', () => {
      const client = new LldapClient(mockConfig);
      const longEmail = 'a'.repeat(300) + '@example.com';

      expect(() => client.validateEmail(longEmail)).toThrow('exceeds maximum length');
    });

    test('rejects invalid email format', () => {
      const client = new LldapClient(mockConfig);

      expect(() => client.validateEmail('not-an-email')).toThrow('Invalid email format');
      expect(() => client.validateEmail('missing@domain')).toThrow('Invalid email format');
    });

    test('rejects username with invalid characters', () => {
      const client = new LldapClient(mockConfig);

      expect(() => client.validateUsername('user@name')).toThrow('invalid characters');
      expect(() => client.validateUsername('user name')).toThrow('invalid characters');
      expect(() => client.validateUsername('user/name')).toThrow('invalid characters');
    });

    test('accepts valid username', () => {
      const client = new LldapClient(mockConfig);

      expect(() => client.validateUsername('valid_user')).not.toThrow();
      expect(() => client.validateUsername('valid.user')).not.toThrow();
      expect(() => client.validateUsername('valid-user')).not.toThrow();
      expect(() => client.validateUsername('ValidUser123')).not.toThrow();
    });

    test('accepts valid email', () => {
      const client = new LldapClient(mockConfig);

      expect(() => client.validateEmail('user@example.com')).not.toThrow();
      expect(() => client.validateEmail('user.name@sub.domain.com')).not.toThrow();
    });
  });

  describe('Debug Output Control', () => {
    test('debug output is disabled by default', () => {
      let debugOutput = '';
      console.error = (msg: string) => {
        if (msg.includes('[DEBUG]')) {
          debugOutput = msg;
        }
      };

      const client = new LldapClient(mockConfig);
      // Trigger internal debug call by calling a method
      client.validateUsername('testuser');

      expect(debugOutput).toBe('');
    });

    test('debug output sanitizes sensitive data when enabled', () => {
      let debugOutput = '';
      console.error = (msg: string) => {
        debugOutput += msg + '\n';
      };

      LldapClient.setDebugEnabled(true);

      globalThis.fetch = createMockFetch(async () => {
        return new Response(JSON.stringify({
          token: 'secret-token-123',
          refreshToken: 'secret-refresh-456',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = new LldapClient({ ...mockConfig, password: 'testpass', token: undefined });
      client.login().then(() => {
        // Check that tokens are redacted in debug output
        expect(debugOutput).not.toContain('secret-token-123');
        expect(debugOutput).not.toContain('testpass');
      });
    });
  });

  describe('Audit Logging', () => {
    test('logs login attempts', async () => {
      const auditLogs: string[] = [];
      console.error = (msg: string) => {
        if (msg.includes('[AUDIT:')) {
          auditLogs.push(msg);
        }
      };

      globalThis.fetch = createMockFetch(async () => {
        return new Response(JSON.stringify({
          token: createTestToken(),
          refreshToken: createTestToken(),
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = new LldapClient({ ...mockConfig, password: 'testpass', token: undefined });
      await client.login();

      expect(auditLogs.some(log => log.includes('login_attempt'))).toBe(true);
      expect(auditLogs.some(log => log.includes('login_success'))).toBe(true);
    });

    test('logs failed login attempts', async () => {
      const auditLogs: string[] = [];
      console.error = (msg: string) => {
        if (msg.includes('[AUDIT:')) {
          auditLogs.push(msg);
        }
      };

      globalThis.fetch = createMockFetch(async () => {
        return new Response('Invalid credentials', { status: 401 });
      });

      const client = new LldapClient({ ...mockConfig, password: 'wrongpass', token: undefined });

      try {
        await client.login();
      } catch {
        // Expected to fail
      }

      expect(auditLogs.some(log => log.includes('login_failed'))).toBe(true);
      expect(auditLogs.some(log => log.includes('SECURITY'))).toBe(true);
    });
  });
});
