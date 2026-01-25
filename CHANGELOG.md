# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2026-01-25


### CI/CD


- Split changelog into unreleased (main) and full (release)


### Documentation


- Update CHANGELOG.md [skip ci]
- Update CHANGELOG.md [skip ci]


### Fixed


- Remove conflicting git-cliff args for changelog generation

## [1.2.0] - 2026-01-25


### CI/CD


- Add CHANGELOG validation before release
- Add Unreleased section to CHANGELOG workflow
- Automate changelog generation with git-cliff
- Add Homebrew tap publishing
- Move changelog generation to main branch merges


### Documentation


- Add CodeQL security badge to README
- Add release management documentation


### Miscellaneous


- Update .gitignore

## [1.1.2] - 2026-01-25


### Added


- Use npm OIDC trusted publishing instead of tokens


### Miscellaneous


- Bump to v1.1.2 for OIDC trusted publishing

## [1.1.1] - 2026-01-25


### Miscellaneous


- Bump to v1.1.1 for CI npm publish fix

## [1.1.0] - 2026-01-25


### Added


- Bump to v1.1.0 with npm installation support


### Fixed


- Lint errors and add npm publish to CI
- Correct npm token interpolation in CI workflow
- Use setup-node action for npm auth


### Miscellaneous


- Fix bin path per npm pkg fix

## [1.0.3] - 2026-01-25


### Added


- Add standard BSD exit codes for scripting
- Add search, group filter, header and quiet mode (v1.0.3)


### Changed


- Rename login -W to -p for intuitive password prompt

## [1.0.0] - 2026-01-25


