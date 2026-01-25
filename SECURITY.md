# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in lldap-cli, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Email the maintainer directly or use [GitHub's private vulnerability reporting](https://github.com/madeinoz67/lldap-cli/security/advisories/new)
3. Include a detailed description of the vulnerability
4. Provide steps to reproduce if possible

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 7 days
- **Fix timeline**: Depends on severity, typically within 30 days

## Security Features

lldap-cli includes the following security measures:

- **Input validation**: All user inputs are validated for length and dangerous characters
- **Rate limiting**: Exponential backoff on 429 responses (max 3 retries)
- **Session timeout**: 30-minute inactivity timeout clears tokens
- **Password complexity**: 8-128 characters, must contain letters and numbers
- **Path traversal protection**: File paths are validated and normalized
- **Sensitive data redaction**: Tokens and passwords are redacted in debug output

## Best Practices

When using lldap-cli:

- Use environment variables or config files for credentials, not command-line arguments
- Use token-based authentication (`LLDAP_TOKEN`) for automation rather than passwords
- Regularly rotate credentials
- Run with minimal required permissions
