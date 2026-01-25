import { ExitCode, type ExitCodeType } from './exitCodes';

/**
 * Base CLI error with exit code
 */
export class CliError extends Error {
  readonly exitCode: ExitCodeType;

  constructor(message: string, exitCode: ExitCodeType = ExitCode.ERROR) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

/**
 * Authentication/authorization error (exit code 77)
 */
export class AuthError extends CliError {
  constructor(message: string) {
    super(message, ExitCode.NOPERM);
    this.name = 'AuthError';
  }
}

/**
 * Configuration error (exit code 78)
 */
export class ConfigError extends CliError {
  constructor(message: string) {
    super(message, ExitCode.CONFIG);
    this.name = 'ConfigError';
  }
}

/**
 * Usage error - invalid arguments (exit code 64)
 */
export class UsageError extends CliError {
  constructor(message: string) {
    super(message, ExitCode.USAGE);
    this.name = 'UsageError';
  }
}

/**
 * Data format error (exit code 65)
 */
export class DataError extends CliError {
  constructor(message: string) {
    super(message, ExitCode.DATAERR);
    this.name = 'DataError';
  }
}

/**
 * Service unavailable (exit code 69)
 */
export class ServiceError extends CliError {
  constructor(message: string) {
    super(message, ExitCode.UNAVAILABLE);
    this.name = 'ServiceError';
  }
}

/**
 * Resource not found - user/group doesn't exist (exit code 67)
 */
export class NotFoundError extends CliError {
  constructor(message: string) {
    super(message, ExitCode.NOUSER);
    this.name = 'NotFoundError';
  }
}

/**
 * I/O error (exit code 74)
 */
export class IOError extends CliError {
  constructor(message: string) {
    super(message, ExitCode.IOERR);
    this.name = 'IOError';
  }
}

/**
 * Temporary failure, can retry (exit code 75)
 */
export class TempError extends CliError {
  constructor(message: string) {
    super(message, ExitCode.TEMPFAIL);
    this.name = 'TempError';
  }
}
