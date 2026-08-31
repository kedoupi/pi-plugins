# Repository Rules

- The root repository is private workspace infrastructure, never a Pi Package.
- First-party packages live only under `packages/` and use `@kedoupi/pi-*` names.
- Never vendor unmodified third-party source; catalog entries contain metadata and upstream links only.
- Do not create an example package, Suite, package-development Skill, or publish workflow until a real first-party package is selected.
- Do not add dependencies when Node.js standard-library code is sufficient.
- Never commit secrets, `.env` files, private local paths, or private inventory results.
- Run `npm run check`, `npm test`, and `npm run pack:check` before claiming completion.
- Publishing always requires explicit maintainer confirmation.
