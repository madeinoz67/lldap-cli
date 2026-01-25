# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-01-25

### Fixed

- Fixed config building to not overwrite defaults with undefined CLI options
- Fixed `.env` file loading - Bun doesn't auto-load .env files in all cases
- Fixed password prompt to hide input when typing (using `stty -echo`)
- Fixed password reading from `/dev/tty` to work with `eval $(...)` pattern
- Added support for both environment variable naming conventions:
  - `LLDAP_HTTP_URL` and `LLDAP_HTTPURL`
  - `LLDAP_REFRESH_TOKEN` and `LLDAP_REFRESHTOKEN`

### Changed

- **BREAKING**: Moved `-W` and `-w` options from global to `login` command
  - Old: `lldap-cli -W login`
  - New: `lldap-cli login -p`
- **BREAKING**: Renamed `-W` to `-p` for more intuitive password prompt flag
  - Old: `lldap-cli login -W`
  - New: `lldap-cli login -p`
- Password prompt now writes to stderr so it's visible when stdout is captured
- Login command works correctly with `eval $(lldap-cli login -p)` pattern

## [1.0.0] - 2026-01-25

### Added

- **User Management**
  - List all users with `user list`
  - Get user details with `user get <userId>`
  - Create users with `user create <userId> <email>`
  - Delete users with `user delete <userId>`
  - Set user passwords with `user set-password <userId>`
  - Manage user attributes (set, clear, add, delete values)

- **Group Management**
  - List all groups with `group list`
  - Get group details with `group get <groupId>`
  - Create groups with `group create <name>`
  - Delete groups with `group delete <groupId>`
  - Add users to groups with `group add-user <groupId> <userId>`
  - Remove users from groups with `group remove-user <groupId> <userId>`
  - Manage group attributes

- **Schema Management**
  - List user schema attributes with `schema user-attrs`
  - List group schema attributes with `schema group-attrs`
  - Add custom attributes with `schema add-attr`
  - Delete custom attributes with `schema del-attr`

- **Authentication**
  - Token-based authentication with JWT
  - Automatic token refresh
  - Session timeout protection (30-minute inactivity)
  - Secure credential handling via environment variables or config file

- **Security Features**
  - Input validation and sanitization
  - Command injection protection
  - Password complexity requirements
  - Rate limiting with exponential backoff
  - Token expiration handling
  - Path traversal protection
  - Audit logging for security events
  - Debug mode with sensitive data redaction
  - Secure HTTP connection warnings

- **Configuration**
  - Environment variable support (`LLDAP_*`)
  - Config file support (`~/.config/lldap-cli/config.json`)
  - CLI option overrides

- **CI/CD**
  - GitHub Actions workflow for lint, test, and build
  - Security scanning with Trivy and TruffleHog
  - Automated releases with standalone binaries for Linux and macOS

### Security

- Comprehensive security hardening based on red team analysis
- 19 security issues addressed across CRITICAL, HIGH, MEDIUM, and LOW severity
- 73 security and functionality tests with 140 assertions
