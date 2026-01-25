/**
 * Standard exit codes following BSD sysexits.h conventions
 * See: https://man.freebsd.org/cgi/man.cgi?query=sysexits
 */

export const ExitCode = {
  /** Successful termination */
  SUCCESS: 0,

  /** Catchall for general errors */
  ERROR: 1,

  /** Command line usage error (invalid arguments, missing required args) */
  USAGE: 64,

  /** Data format error (input data was incorrect) */
  DATAERR: 65,

  /** Cannot open input (file not found) */
  NOINPUT: 66,

  /** Addressee unknown (user doesn't exist) */
  NOUSER: 67,

  /** Host name unknown (host not found) */
  NOHOST: 68,

  /** Service unavailable (server down, connection refused) */
  UNAVAILABLE: 69,

  /** Internal software error (bug in the program) */
  SOFTWARE: 70,

  /** System error (e.g., can't fork) */
  OSERR: 71,

  /** Critical OS file missing */
  OSFILE: 72,

  /** Can't create output file (permission denied, disk full) */
  CANTCREAT: 73,

  /** Input/output error */
  IOERR: 74,

  /** Temporary failure, retry later */
  TEMPFAIL: 75,

  /** Remote error in protocol */
  PROTOCOL: 76,

  /** Permission denied (authentication/authorization failed) */
  NOPERM: 77,

  /** Configuration error */
  CONFIG: 78,
} as const;

export type ExitCodeType = (typeof ExitCode)[keyof typeof ExitCode];
