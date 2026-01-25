# Release Management

This document describes the release process for lldap-cli.

## Overview

lldap-cli uses automated release management with:
- **Conventional Commits** for structured commit messages
- **git-cliff** for automated changelog generation
- **GitHub Actions** for CI/CD pipeline
- **npm OIDC Trusted Publishing** for secure npm releases

## Commit Message Format

All commits should follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description | Changelog Section |
|------|-------------|-------------------|
| `feat` | New feature | Added |
| `fix` | Bug fix | Fixed |
| `docs` | Documentation only | Documentation |
| `perf` | Performance improvement | Performance |
| `refactor` | Code change (no feature/fix) | Changed |
| `style` | Formatting, missing semicolons | Styling |
| `test` | Adding/updating tests | Testing |
| `chore` | Maintenance tasks | Miscellaneous |
| `ci` | CI/CD changes | CI/CD |

### Examples

```bash
feat: add user search functionality
fix: resolve password prompt on Windows
docs: update README with new options
ci: add automated changelog generation
chore(deps): bump commander to v14
```

## Release Process

### 1. Prepare Release

Ensure all changes are merged to `main` and CI is passing.

```bash
# Verify clean working directory
git checkout main
git pull origin main
git status
```

### 2. Update Version

Update the version in `package.json`:

```bash
# Edit package.json version field
# Follow semantic versioning: MAJOR.MINOR.PATCH
```

### 3. Commit Version Bump

```bash
git add package.json
git commit -m "chore(release): bump version to X.Y.Z"
git push origin main
```

### 4. Create and Push Tag

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

### 5. Automated Pipeline

When a tag is pushed, GitHub Actions automatically:

1. **Security Scan** - Trivy vulnerability + TruffleHog secret scanning
2. **Lint** - ESLint + TypeScript type checking
3. **Test** - Run test suite
4. **Build** - Compile TypeScript
5. **Release** - Create GitHub release with:
   - Auto-generated release notes from git-cliff
   - Standalone binaries (linux-x64, linux-arm64, darwin-x64, darwin-arm64)
6. **Update Changelog** - Regenerate CHANGELOG.md and commit to main
7. **Publish** - Publish to npm using OIDC trusted publishing

## npm OIDC Trusted Publishing

This project uses npm's OIDC trusted publishing instead of classic tokens:

- **No secrets required** - Authentication uses GitHub's OIDC provider
- **More secure** - No long-lived tokens to manage or rotate
- **Automatic** - Works seamlessly with GitHub Actions

### Setup Requirements

1. npm package must have trusted publishing configured at npmjs.com
2. GitHub Actions workflow needs `id-token: write` permission
3. `NODE_AUTH_TOKEN` must NOT be set (blocks OIDC auth)

## Versioning Guidelines

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features, backwards compatible
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, backwards compatible

## Changelog

The changelog is automatically generated from conventional commits using git-cliff:

- **CHANGELOG.md** - Full project history, auto-updated on release
- **Release Notes** - Per-release notes on GitHub release page

Configuration: `cliff.toml`

## Troubleshooting

### npm publish fails with EOTP error

Ensure trusted publishing is configured on npmjs.com and `NODE_AUTH_TOKEN` is not set.

### Changelog not generated

Verify commits follow conventional commit format. Non-conventional commits are filtered out.

### Release job fails

Check that the tag follows the `v*` pattern (e.g., `v1.2.3`).
