# Development Guide

## Current status

The repository foundation is being established. Application packages and runtime commands will be documented as they are added.

## Conventions

- TypeScript strict mode.
- pnpm workspaces.
- Small, domain-focused packages.
- Validated inputs at trust boundaries.
- No secrets in source control.
- Tests required for security-sensitive logic.
- Database changes must use versioned migrations.

## Quality gates

Before merging changes, run the applicable checks: formatting, linting, type checking, unit and integration tests, production build, and security-focused tests for affected boundaries.
