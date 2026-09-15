# Coding Guidelines

These guidelines apply to `web/src`.

## Naming

Use kebab-case for directories and non-component files.

Use PascalCase for Svelte component files (`*.svelte`).

Svelte module files (`*.svelte.ts`) are not components and should use kebab-case.

Framework- or tool-defined names are exempt and should follow their respective conventions, such as `+page.svelte`, `+layout.svelte`, and `hooks.server.ts`.

Existing files and directories do not need to be renamed solely to comply with these conventions.

## Formatting

Formatting is defined by [Prettier](../web/.prettierrc) and [EditorConfig](../.editorconfig).

## Linting

Linting rules are defined by [ESLint](../web/eslint.config.mjs).
