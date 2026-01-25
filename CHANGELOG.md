# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]


### Fixed


- Resolve ReDoS vulnerability in email validation (CWE-1333)


### Security


- Simplify changelog to user-facing changes only

## [1.2.1] - 2026-01-25


### Fixed


- Remove conflicting git-cliff args for changelog generation

## [1.1.2] - 2026-01-25


### Added


- Use npm OIDC trusted publishing instead of tokens

## [1.1.0] - 2026-01-25


### Added


- Bump to v1.1.0 with npm installation support


### Fixed


- Lint errors and add npm publish to CI
- Correct npm token interpolation in CI workflow
- Use setup-node action for npm auth

## [1.0.3] - 2026-01-25


### Added


- Add standard BSD exit codes for scripting
- Add search, group filter, header and quiet mode (v1.0.3)

## [1.0.0] - 2026-01-25


