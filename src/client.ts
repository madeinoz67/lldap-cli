import { readFileSync, existsSync } from 'fs';
import { resolve, normalize } from 'path';
import type { Config, AuthTokens, GraphQLResponse } from './types';

// Audit log levels
type AuditLevel = 'info' | 'warn' | 'error' | 'security';

export class LldapClient {
  private config: Config;
  private token?: string;
  private refreshToken?: string;
  private shouldLogout = false;
  private rateLimitRetryCount = 0;
  private lastActivityTime: number;
  private static readonly MAX_RATE_LIMIT_RETRIES = 3;
  private static readonly RATE_LIMIT_BACKOFF_MS = 1000;
  private static readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  private static readonly MAX_INPUT_LENGTH = 1000; // Maximum length for user inputs
  private static readonly MAX_EMAIL_LENGTH = 254; // RFC 5321
  private static readonly MAX_USERNAME_LENGTH = 64;
  private static debugEnabled = false;

  constructor(config: Config) {
    this.config = config;
    this.token = config.token;
    this.refreshToken = config.refreshToken;
    this.lastActivityTime = Date.now();
  }

  /**
   * Enable or disable debug output
   */
  static setDebugEnabled(enabled: boolean): void {
    LldapClient.debugEnabled = enabled;
  }

  /**
   * Debug logging - only outputs when debug mode is enabled
   */
  private debug(message: string): void {
    if (LldapClient.debugEnabled) {
      // Sanitize any potential sensitive data in debug output
      const sanitized = message
        .replace(/token[=:]\S+/gi, 'token=[REDACTED]')
        .replace(/password[=:]\S+/gi, 'password=[REDACTED]')
        .replace(/Bearer \S+/gi, 'Bearer [REDACTED]');
      console.error(`[DEBUG] ${new Date().toISOString()} ${sanitized}`);
    }
  }

  /**
   * Audit logging for security-relevant events
   */
  private audit(level: AuditLevel, action: string, details?: Record<string, unknown>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      action,
      ...details,
    };
    // Write to stderr to separate from normal output
    // In production, this could be directed to a secure audit log
    console.error(`[AUDIT:${level.toUpperCase()}] ${JSON.stringify(entry)}`);
  }

  /**
   * Check if session has timed out due to inactivity
   */
  private checkSessionTimeout(): void {
    const now = Date.now();
    const elapsed = now - this.lastActivityTime;

    if (elapsed > LldapClient.SESSION_TIMEOUT_MS) {
      this.audit('security', 'session_timeout', { elapsed_ms: elapsed });
      // Clear tokens on timeout
      this.token = undefined;
      this.refreshToken = undefined;
      throw new Error('Session timed out due to inactivity. Please re-authenticate.');
    }

    this.lastActivityTime = now;
  }

  /**
   * Validate input length to prevent DoS and buffer issues
   */
  private validateInputLength(value: string, fieldName: string, maxLength: number = LldapClient.MAX_INPUT_LENGTH): void {
    if (value.length > maxLength) {
      this.audit('warn', 'input_length_exceeded', { field: fieldName, length: value.length, max: maxLength });
      throw new Error(`${fieldName} exceeds maximum length of ${maxLength} characters`);
    }
  }

  /**
   * Validate username format and length
   */
  validateUsername(username: string): void {
    this.validateInputLength(username, 'username', LldapClient.MAX_USERNAME_LENGTH);
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      throw new Error('Username contains invalid characters. Only alphanumeric, underscore, dot, and hyphen allowed.');
    }
  }

  /**
   * Validate email format and length
   */
  validateEmail(email: string): void {
    this.validateInputLength(email, 'email', LldapClient.MAX_EMAIL_LENGTH);
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Invalid email format');
    }
  }

  /**
   * Validate generic string input
   */
  validateStringInput(value: string, fieldName: string): void {
    this.validateInputLength(value, fieldName);
  }

  /**
   * Check if a JWT token is expired or about to expire
   */
  private isTokenExpired(token: string, bufferSeconds = 60): boolean {
    try {
      // JWT format: header.payload.signature
      const parts = token.split('.');
      if (parts.length !== 3) {
        return true; // Invalid token format
      }

      // Decode the payload (base64url)
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(atob(payload));

      if (!decoded.exp) {
        return false; // No expiration, assume valid
      }

      const expirationTime = decoded.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const bufferMs = bufferSeconds * 1000;

      return now >= expirationTime - bufferMs;
    } catch {
      // If we can't decode the token, assume it might be expired
      return true;
    }
  }

  /**
   * Validate file path to prevent path traversal attacks
   */
  private validateFilePath(filePath: string, allowedDir?: string): string {
    const resolved = resolve(filePath);
    const normalized = normalize(resolved);

    // Prevent path traversal
    if (normalized.includes('..')) {
      throw new Error('Invalid file path: path traversal detected');
    }

    // If an allowed directory is specified, ensure the file is within it
    if (allowedDir) {
      const allowedResolved = resolve(allowedDir);
      if (!normalized.startsWith(allowedResolved)) {
        throw new Error(`Invalid file path: must be within ${allowedDir}`);
      }
    }

    return normalized;
  }

  /**
   * Handle rate limiting with exponential backoff
   */
  private async handleRateLimit<T>(operation: () => Promise<T>): Promise<T> {
    while (this.rateLimitRetryCount < LldapClient.MAX_RATE_LIMIT_RETRIES) {
      try {
        const result = await operation();
        this.rateLimitRetryCount = 0; // Reset on success
        return result;
      } catch (error) {
        if (error instanceof Error && error.message.includes('429')) {
          this.rateLimitRetryCount++;
          if (this.rateLimitRetryCount >= LldapClient.MAX_RATE_LIMIT_RETRIES) {
            throw new Error('Rate limit exceeded. Please try again later.');
          }
          const backoff = LldapClient.RATE_LIMIT_BACKOFF_MS * Math.pow(2, this.rateLimitRetryCount - 1);
          console.error(`Rate limited. Retrying in ${backoff}ms... (attempt ${this.rateLimitRetryCount}/${LldapClient.MAX_RATE_LIMIT_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, backoff));
        } else {
          throw error;
        }
      }
    }
    throw new Error('Rate limit exceeded. Please try again later.');
  }

  /**
   * Authenticate and get tokens
   */
  async login(username?: string, password?: string): Promise<AuthTokens> {
    return this.handleRateLimit(async () => {
      const url = `${this.config.httpUrl}${this.config.endpoints.auth}`;
      const user = username || this.config.username;
      const pass = password || this.config.password;

      if (!user || !pass) {
        throw new Error('Username and password are required for login');
      }

      // Validate input lengths
      this.validateUsername(user);

      this.debug(`Attempting login for user: ${user}`);
      this.audit('info', 'login_attempt', { username: user });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass }),
      });

      if (response.status === 429) {
        this.audit('warn', 'login_rate_limited', { username: user });
        throw new Error('429 Rate limit exceeded');
      }

      if (!response.ok) {
        const text = await response.text();
        this.audit('security', 'login_failed', { username: user, status: response.status });
        // Sanitize error to avoid credential leakage
        const sanitizedText = text.replace(/password[=:]\S+/gi, 'password=[REDACTED]');
        throw new Error(`Login failed: ${sanitizedText}`);
      }

      const data = await response.json();
      this.token = data.token;
      this.refreshToken = data.refreshToken;
      this.lastActivityTime = Date.now(); // Reset session timer on login

      this.audit('info', 'login_success', { username: user });
      this.debug('Login successful');

      return { token: data.token, refreshToken: data.refreshToken };
    });
  }

  /**
   * Refresh the authentication token
   */
  async refresh(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('Refresh token is required');
    }

    const url = `${this.config.httpUrl}${this.config.endpoints.refresh}`;
    const response = await fetch(url, {
      headers: { Cookie: `refresh_token=${this.refreshToken}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token refresh failed: ${text}`);
    }

    const data = await response.json();
    this.token = data.token;
    return data.token;
  }

  /**
   * Logout and invalidate tokens
   */
  async logout(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('Refresh token is required for logout');
    }

    const url = `${this.config.httpUrl}${this.config.endpoints.logout}`;
    await fetch(url, {
      headers: { Cookie: `refresh_token=${this.refreshToken}` },
    });
  }

  /**
   * Ensure we have a valid token, logging in if necessary
   */
  async ensureAuthenticated(): Promise<void> {
    // Check session timeout first
    this.checkSessionTimeout();

    // Check if current token exists and is not expired
    if (this.token && !this.isTokenExpired(this.token)) {
      this.debug('Using existing valid token');
      return;
    }

    // Token expired or missing, try to refresh
    if (this.refreshToken) {
      // Check if refresh token is also expired
      if (this.isTokenExpired(this.refreshToken, 300)) {
        this.audit('warn', 'refresh_token_expiring');
        console.error('WARNING: Refresh token is expired or about to expire. Re-authentication may be required.');
      }
      this.debug('Refreshing token');
      await this.refresh();
      return;
    }

    this.debug('No valid token, initiating login');
    await this.login();
    this.shouldLogout = true;
  }

  /**
   * Clean up - logout if we logged in during this session
   */
  async cleanup(): Promise<void> {
    if (this.shouldLogout && this.refreshToken) {
      await this.logout();
    }
  }

  /**
   * Execute a GraphQL query
   */
  async query<T>(
    query: string,
    variables?: Record<string, unknown>,
    file?: string
  ): Promise<T> {
    return this.handleRateLimit(async () => {
      await this.ensureAuthenticated();

      const url = `${this.config.httpUrl}${this.config.endpoints.graphql}`;
      let body: string;

      if (file) {
        // Validate file path to prevent path traversal
        const validatedPath = this.validateFilePath(file);

        if (!existsSync(validatedPath)) {
          throw new Error(`File not found: ${file}`);
        }

        const fileContent = readFileSync(validatedPath);
        const base64 = fileContent.toString('base64');
        // For file uploads, we need to include the base64 content in the variables
        const varsWithFile = { ...variables };
        // The GraphQL query expects the file content in a specific variable
        body = JSON.stringify({
          query,
          variables: varsWithFile,
        });
        // Inject base64 content where needed
        if (body.includes('""')) {
          body = body.replace('""', `"${base64}"`);
        }
      } else {
        body = JSON.stringify({
          query,
          variables: variables || {},
        });
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body,
      });

      if (response.status === 401) {
        throw new Error('Authentication failed. Token may be expired. Try logging in again.');
      }

      if (response.status === 429) {
        throw new Error('429 Rate limit exceeded');
      }

      if (!response.ok) {
        const text = await response.text();
        // Sanitize error message to avoid leaking sensitive info
        const sanitizedText = text.replace(/token[=:]\S+/gi, 'token=[REDACTED]');
        throw new Error(`GraphQL request failed (${response.status}): ${sanitizedText}`);
      }

      const result: GraphQLResponse<T> = await response.json();

      if (result.errors?.length) {
        // Sanitize GraphQL errors
        const sanitizedErrors = result.errors.map((e) =>
          e.message.replace(/token[=:]\S+/gi, 'token=[REDACTED]')
        );
        throw new Error(`GraphQL error: ${sanitizedErrors.join(', ')}`);
      }

      if (!result.data) {
        throw new Error('No data returned from GraphQL query');
      }

      return result.data;
    });
  }

  getToken(): string | undefined {
    return this.token;
  }

  getRefreshToken(): string | undefined {
    return this.refreshToken;
  }
}
