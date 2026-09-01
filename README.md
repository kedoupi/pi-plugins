# Kedoupi Pi Plugins

[English](./README.md) | [简体中文](./README.zh-CN.md)

[![CI](https://github.com/kedoupi/pi-plugins/actions/workflows/ci.yml/badge.svg)](https://github.com/kedoupi/pi-plugins/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js >=22](https://img.shields.io/badge/Node.js-%3E%3D22-339933.svg)](https://nodejs.org/)

## About

Kedoupi Pi Plugins is the `@kedoupi` home for first-party [Pi](https://github.com/badlogic/pi-mono) Packages, shared development standards, and a manually curated community catalog.

> This is an independent, unofficial Pi ecosystem project. Third-party entries retain their original authors, licenses, and upstream links; inclusion is not a security guarantee.

The repository root is a private development workspace, not an installable Pi Package.

## Features

- Independent `@kedoupi/pi-*` Packages under `packages/`.
- Deterministic validation for Package manifests, tarballs, catalogs, and README structure.
- A maintainer-reviewed directory of useful third-party Pi Packages.
- Documented local development, testing, publishing, and security rules.
- Node.js 22 CI with no publishing credentials.

No first-party Package is published yet; this repository does not use empty examples as installable products.

## Curated Catalog

Browse [CATALOG.md](./CATALOG.md) for community Packages and their bilingual, manually researched usage and security details, plus upstream repositories, licenses, and recommendations.

Catalog submissions are accepted through pull requests. The `tested` and `reviewed` statuses require maintainer evidence; contributors may submit new entries as `community` only. Catalog research is not the same as executing every Package or completing a full security review. See the [catalog policy](./docs/catalog-policy.md).

## Repository Structure

```text
packages/              independent first-party Pi Packages
catalog/plugins.json   curated catalog source
CATALOG.md              generated catalog view
scripts/                repository validation and rendering
.pi/settings.json       project-local Pi development configuration
docs/                   standards and workflows
```

The root `package.json` is private and intentionally has no `pi` manifest.

## Development

Requirements: Node.js 22 or newer and npm.

```bash
npm ci --ignore-scripts
npm run check
npm test
npm run pack:check
```

Read the project guides before adding a Package:

- [Project charter](./docs/project-charter.md)
- [Package standard](./docs/package-standard.md)
- [Development workflow](./docs/development.md)
- [Testing](./docs/testing.md)
- [Publishing](./docs/publishing.md)
- [Catalog policy](./docs/catalog-policy.md)

## Contributing

Issues and pull requests are welcome. Keep changes focused, include tests for executable behavior, and complete the catalog checklist when changing third-party metadata.

First-party Packages must follow the [Package standard](./docs/package-standard.md). Third-party source code is never copied into this repository.

## Security

Pi Extensions run with the current user's permissions. Review source code, published tarball contents, requested credentials, network behavior, and subprocess usage before installing any Package.

Do not commit secrets, `.env` files, private inventory, or machine-specific paths. Report security concerns privately to the repository maintainer instead of opening a public exploit report.

## Roadmap

The next milestone starts only after selecting a real first-party Package by user-visible purpose and name. It will validate project-local loading, global dogfooding, trusted publishing, installation lifecycle behavior, and first-party suite integration from the proven Package workflow.

Speculative demonstration Packages remain out of scope.

## License

Repository-authored content is available under the [MIT License](./LICENSE). Each cataloged third-party Package remains governed by its upstream license.
