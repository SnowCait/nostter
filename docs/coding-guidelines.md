# Coding Guidelines

These guidelines apply to `web/src`.

## Naming

Use kebab-case for directories and non-component files.

Use PascalCase for Svelte component files (`*.svelte`).

Svelte module files (`*.svelte.ts`) are not components and should use kebab-case.

Framework- or tool-defined names are exempt and should follow their respective conventions, such as `+page.svelte`, `+layout.svelte`, and `hooks.server.ts`.

Existing files and directories do not need to be renamed solely to comply with these conventions.

## Imports

Prefer public subpath exports over package-root imports when available.

## Constants and utilities

Prefer existing named constants and shared utilities over magic values or duplicate implementations.

## Formatting

Formatting is defined by [Prettier](../web/.prettierrc) and [EditorConfig](../.editorconfig).

## Linting

Linting rules are defined by [ESLint](../web/eslint.config.mjs).

## Comments

Do not add comments that merely restate what the code already makes clear.

Use comments only to explain non-obvious reasons, constraints, or behavior.

## Reactive cleanup

Clean up subscriptions and asynchronous effects so stale work cannot update current state.

## Tests

Test meaningful behavior and regressions; avoid tests that only verify library behavior or implementation details.
