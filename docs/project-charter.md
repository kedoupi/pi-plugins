# Project Charter

[English](./project-charter.md) | [简体中文](./project-charter.zh-CN.md)

## Mission

Kedoupi Pi Plugins is a trustworthy discovery and publishing system for Pi Packages: a home for independent `@kedoupi` first-party Packages, shared development standards, and a manually curated directory of public community Packages.

The goal is not to collect the most plugins. The goal is to make each published claim, installation path, and maintenance decision understandable and verifiable.

## Scope

This repository provides:

- independent first-party Packages under `packages/`;
- standards for development, testing, security, and publishing;
- a curated third-party catalog with bilingual research notes;
- deterministic repository checks and generated catalog output.

The repository root is private workspace infrastructure, never an installable or publishable Pi Package. Kedoupi documents and evaluates third-party Packages but does not repackage their source code or include them in a first-party Suite.

## Non-goals

The project does not create placeholder Packages, an empty Suite, speculative abstractions, or publishing automation before a real first-party Package needs them. It does not mirror third-party repositories, promise absolute security, or treat public documentation research as functional testing.

New infrastructure must follow demonstrated need. A real workflow is completed once before it is turned into a template, Suite, Skill, or broader abstraction.

## Operating Principles

1. **Real value before visible completeness.** An explicit gap is better than a fictional product.
2. **Evidence before claims.** Research, execution, sensitive-operation review, compatibility, and security are separate claims with separate evidence.
3. **Policy as code where practical.** Deterministic rules belong in offline validation; judgment remains with maintainers.
4. **First-party ownership without third-party appropriation.** Upstream authorship, licenses, links, and maintenance boundaries remain visible.
5. **Standard library and native tooling first.** Dependencies and automation must justify their ongoing cost.
6. **Independent release units.** First-party Packages own their versions, changelogs, tests, tags, and releases.
7. **Security language stays conservative.** `tested` and `reviewed` never mean risk-free.

## Evidence Model

Catalog status is an evidence ladder, not a ranking of popularity:

- `community`: public metadata and bilingual documentation were researched and validated.
- `tested`: a maintainer actually installed and used the recorded version with the recorded Pi version.
- `reviewed`: the tested Package also received focused inspection of entry points, permissions, files, network access, credentials, subprocesses, or other sensitive behavior.
- `deprecated`: the Package is no longer recommended because its source, maintenance, accuracy, or suitability no longer meets the catalog policy.

A maintainer's local Package list is a candidate-discovery signal, not a mirror of Catalog membership. A newly installed Package is researched before inclusion, and uninstalling one does not remove its recommendation without separate maintenance, accuracy, or suitability evidence.

Local installation or documentation review alone does not create test evidence. Status promotion requires maintainer-owned evidence under the [Catalog Policy](./catalog-policy.md).

## Package Lifecycles

A third-party Package moves through:

```text
public candidate
→ source, license, and metadata research
→ bilingual details and risk disclosure
→ offline validation
→ community
→ isolated functional testing
→ tested
→ sensitive-operation review
→ reviewed
→ deprecated when necessary
```

A first-party Package moves through:

```text
real user need and stable name
→ independent workspace implementation
→ project-local loading and automated checks
→ global source dogfood on a real task
→ independent npm release
→ install, update, uninstall, and rollback verification
→ optional first-party Suite membership
```

See the [Development Workflow](./development.md), [Testing Policy](./testing.md), [Publishing Policy](./publishing.md), and [First-party Package Standard](./package-standard.md) for executable requirements.

## Automation and Security Boundaries

Repository CI is offline, deterministic, and based on Node.js standard-library code where sufficient. It validates repository-owned structure, metadata, documentation contracts, generated output, and package contents. It does not crawl websites, synchronize databases, call paid services, or decide that old research is automatically false.

No secret, `.env` file, private inventory, real credential, Cookie, or machine-specific path belongs in the repository. Pi Extensions run with the current user's permissions, so documentation must disclose relevant file, network, credential, subprocess, and paid-service behavior.

## Decision Rights

Community contributors may propose Packages and submit `community` metadata. Maintainers own Catalog inclusion, evidence-based status promotion, deprecation, first-party Package selection, Suite membership, and every publishing action. Publishing always requires explicit maintainer confirmation.

## Current State and Next Gate

The repository foundation and bilingual Catalog workflow are proven. The Catalog currently covers public community Packages without claiming they were functionally tested by Kedoupi.

The first-party lifecycle is designed but not yet proven end to end. The next gate is selecting one Package with a real user-visible purpose and stable name, then completing project-local testing, global dogfood, publishing, installation, update, uninstall, and rollback. A Suite, reusable package-development Skill, and publishing workflow remain deferred until that real cycle justifies them.

## Canonical Policies

This Charter defines the project-level intent and boundaries. Detailed, enforceable rules remain authoritative in:

- [First-party Package Standard](./package-standard.md)
- [Development Workflow](./development.md)
- [Testing Policy](./testing.md)
- [Publishing Policy](./publishing.md)
- [Catalog Policy](./catalog-policy.md)

When this Charter and a detailed policy appear to conflict, resolve the inconsistency explicitly rather than silently choosing one document.
