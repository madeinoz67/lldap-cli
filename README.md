# lldap-cli

A TypeScript CLI tool for managing [LLDAP](https://github.com/lldap/lldap) (Lightweight LDAP) users, groups, and schema.

Built with [Bun](https://bun.sh/) for fast execution and modern TypeScript support.

[![CI](https://github.com/madeinoz67/lldap-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/madeinoz67/lldap-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![GitHub release](https://img.shields.io/github/v/release/madeinoz67/lldap-cli)](https://github.com/madeinoz67/lldap-cli/releases)
[![GitHub issues](https://img.shields.io/github/issues/madeinoz67/lldap-cli)](https://github.com/madeinoz67/lldap-cli/issues)

## Features

- **User Management** - Create, list, update, and delete users
- **Group Management** - Create, list, and manage group membership
- **Schema Management** - View and modify custom user/group attributes
- **Secure Authentication** - JWT-based auth with automatic token refresh
- **Security Hardened** - Input validation, rate limiting, audit logging

## Installation

### From Release

Download the standalone binary for your platform from the [releases page](https://github.com/madeinoz67/lldap-cli/releases):

```bash
# Linux x64
curl -LO https://github.com/madeinoz67/lldap-cli/releases/latest/download/lldap-cli-linux-x64
chmod +x lldap-cli-linux-x64
sudo mv lldap-cli-linux-x64 /usr/local/bin/lldap-cli

# Linux ARM64
curl -LO https://github.com/madeinoz67/lldap-cli/releases/latest/download/lldap-cli-linux-arm64
chmod +x lldap-cli-linux-arm64
sudo mv lldap-cli-linux-arm64 /usr/local/bin/lldap-cli

# macOS x64 (Intel)
curl -LO https://github.com/madeinoz67/lldap-cli/releases/latest/download/lldap-cli-darwin-x64
chmod +x lldap-cli-darwin-x64
sudo mv lldap-cli-darwin-x64 /usr/local/bin/lldap-cli

# macOS ARM64 (Apple Silicon)
curl -LO https://github.com/madeinoz67/lldap-cli/releases/latest/download/lldap-cli-darwin-arm64
chmod +x lldap-cli-darwin-arm64
sudo mv lldap-cli-darwin-arm64 /usr/local/bin/lldap-cli
```

### From Source

```bash
# Clone the repository
git clone https://github.com/madeinoz67/lldap-cli.git
cd lldap-cli

# Install dependencies
bun install

# Build
bun run build

# Run directly with Bun
bun run dev -- user list
```

## Configuration

### Environment Variables

```bash
export LLDAP_HTTP_URL="http://localhost:17170"
export LLDAP_USERNAME="admin"
export LLDAP_PASSWORD="your-password"
# Or use tokens (set automatically by eval $(lldap-cli login -p))
export LLDAP_TOKEN="your-jwt-token"
export LLDAP_REFRESH_TOKEN="your-refresh-token"
```

You can also create a `.env` file in your working directory with these variables - it will be loaded automatically.

### Config File

Create `~/.config/lldap-cli/config.json`:

```json
{
  "httpUrl": "http://localhost:17170",
  "username": "admin"
}
```

### CLI Options

CLI options override environment variables and config file:

```bash
lldap-cli -H http://localhost:17170 -u admin user list
```

## Usage

### Authentication

```bash
# Login with password prompt (recommended - password hidden, tokens set automatically)
eval $(lldap-cli login -p)

# Login with password on command line (less secure)
eval $(lldap-cli login -w password)

# Login and save tokens to file (most secure for scripts)
lldap-cli login -p -o ~/.lldap-tokens
source ~/.lldap-tokens

# Logout and invalidate tokens
eval $(lldap-cli logout)
```

The `-p` flag prompts for password securely (input hidden). The `eval $(...)` pattern automatically sets `LLDAP_TOKEN` and `LLDAP_REFRESHTOKEN` environment variables for subsequent commands.

### User Management

```bash
# List users
lldap-cli user list              # List user IDs (default)
lldap-cli user list email        # List user emails
lldap-cli user list all          # Table with ID, email, display name
lldap-cli user list -g admins    # List users in 'admins' group
lldap-cli user list all -g staff # Table of users in 'staff' group
lldap-cli user info              # Show detailed user info

# Search users (supports * and ? wildcards)
lldap-cli user search john       # Search by uid, email, or display name
lldap-cli user search "*@corp.com"  # Find users with corp.com email
lldap-cli user search "svc_*"    # Find service accounts

# Create a user
lldap-cli user add jsmith john@example.com -d "John Smith" -f John -l Smith

# Delete a user
lldap-cli user del jsmith

# Set user password (requires lldap_set_password tool)
lldap-cli user set-password jsmith

# Update user attributes
lldap-cli user update set jsmith displayName "Johnny Smith"
lldap-cli user update clear jsmith avatar
lldap-cli user update add jsmith mailAlias "johnny@example.com"
lldap-cli user update del jsmith mailAlias "johnny@example.com"

# User attributes
lldap-cli user attribute list jsmith
lldap-cli user attribute values jsmith mailAlias

# User group membership
lldap-cli user group list jsmith
lldap-cli user group add jsmith "mail users"
lldap-cli user group del jsmith "mail users"
```

### Group Management

```bash
# List groups
lldap-cli group list

# Search groups (supports * and ? wildcards)
lldap-cli group search admin*    # Find groups starting with 'admin'
lldap-cli group search "*users"  # Find groups ending with 'users'

# Create a group
lldap-cli group add "mail users"

# Delete a group
lldap-cli group del "mail users"

# Show users in a group
lldap-cli group info "mail users"

# Add/remove users
lldap-cli group add-user 1 jsmith
lldap-cli group remove-user 1 jsmith

# Update group attributes
lldap-cli group update set "mail users" description "Mail system users"

# Group attributes
lldap-cli group attribute list "mail users"
lldap-cli group attribute values "mail users" description
```

### Schema Management

```bash
# User schema attributes
lldap-cli schema attribute user list
lldap-cli schema attribute user add mailAlias string -l -v    # list, visible
lldap-cli schema attribute user del mailAlias

# Group schema attributes
lldap-cli schema attribute group list
lldap-cli schema attribute group add memberCount integer
lldap-cli schema attribute group del memberCount

# User object classes
lldap-cli schema objectclass user list
lldap-cli schema objectclass user add inetOrgPerson
lldap-cli schema objectclass user del inetOrgPerson

# Group object classes
lldap-cli schema objectclass group list
lldap-cli schema objectclass group add posixGroup
lldap-cli schema objectclass group del posixGroup
```

### Attribute Types

When adding schema attributes, use one of:
- `string` - Text values
- `integer` - Numeric values
- `date_time` - Date/time values
- `jpeg_photo` - Binary image data

### Attribute Options

- `-l, --list` - Attribute can have multiple values
- `-v, --visible` - Attribute is visible in LDAP queries
- `-e, --editable` - Attribute can be modified via LDAP

### Global Options

| Option | Description |
|--------|-------------|
| `-H, --http-url <url>` | LLDAP HTTP URL |
| `-u, --username <user>` | Username for authentication |
| `-t, --token <token>` | JWT access token |
| `-r, --refresh-token <token>` | JWT refresh token |
| `-q, --quiet` | Suppress header and non-essential output |
| `--debug` | Enable debug output (WARNING: may expose sensitive info) |
| `-h, --help` | Show help |
| `-V, --version` | Show version |

### Login Options

| Option | Description |
|--------|-------------|
| `-p, --prompt-password` | Prompt for password (input hidden) |
| `-w, --password <pass>` | Password on command line (less secure) |
| `-o, --output <file>` | Write tokens to file instead of stdout |
| `-q, --quiet` | Suppress security warnings |

## Programmatic Usage

```typescript
import { LldapClient, UserService, GroupService, SchemaService, buildConfig } from 'lldap-cli';

const config = buildConfig({
  httpUrl: 'http://localhost:17170',
  username: 'admin',
  password: 'password',
});

const client = new LldapClient(config);
const userService = new UserService(client);

// List all users
const users = await userService.getUsers();
console.log(users);

// Clean up
await client.cleanup();
```

## Exit Codes

The CLI uses standard BSD sysexits.h exit codes for scripting:

| Code | Name | Description |
|------|------|-------------|
| 0 | SUCCESS | Command completed successfully |
| 1 | ERROR | General/unknown error |
| 64 | USAGE | Invalid arguments or usage |
| 69 | UNAVAILABLE | Service unavailable (server down) |
| 74 | IOERR | I/O error (file not found) |
| 75 | TEMPFAIL | Temporary failure (rate limited) |
| 77 | NOPERM | Authentication/authorization failed |
| 78 | CONFIG | Configuration error |

Example scripting usage:
```bash
lldap-cli login -p
case $? in
  0)  echo "Login successful" ;;
  77) echo "Authentication failed" ;;
  78) echo "Configuration error - check username/URL" ;;
  *)  echo "Other error: $?" ;;
esac
```

## Security Features

This CLI includes comprehensive security hardening:

| Feature | Description |
|---------|-------------|
| **Input Validation** | All inputs validated for length and dangerous characters |
| **Password Complexity** | Passwords must be 8-128 chars with letters and numbers |
| **Rate Limiting** | Exponential backoff on 429 responses (max 3 retries) |
| **Session Timeout** | 30-minute inactivity timeout |
| **Token Management** | Automatic refresh, expiration detection |
| **Audit Logging** | Security events logged to stderr |
| **Error Sanitization** | Sensitive data redacted from error messages |
| **Path Traversal Protection** | File paths validated to prevent attacks |
| **HTTPS Warning** | Warns when using HTTP to non-localhost servers |

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Run tests in watch mode
bun test --watch

# Type check
bun run typecheck

# Lint
bun run lint

# Lint and fix
bun run lint:fix

# Build
bun run build
```

## Requirements

- [Bun](https://bun.sh/) 1.0+ (for development/running from source)
- LLDAP server running and accessible
- `lldap_set_password` tool (optional, for password management)

## License

MIT License - Copyright (c) 2026 Stephen Eaton

See [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please ensure:

1. All tests pass (`bun test`)
2. Code passes linting (`bun run lint`)
3. TypeScript compiles without errors (`bun run typecheck`)
4. Security scanning passes (Trivy, TruffleHog)

## Acknowledgments

- [LLDAP](https://github.com/lldap/lldap) - The lightweight LDAP server this tool manages
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [Bun](https://bun.sh/) - JavaScript runtime and toolkit
