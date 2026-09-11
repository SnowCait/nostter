# Architecture

This document defines the target architecture for the nostter web application.

It is a target for new code and incremental refactoring, not a description of the current directory structure. Existing placement is not architectural precedent.

Coding conventions are defined separately in [`docs/coding-guidelines.md`](docs/coding-guidelines.md).

## Structure

```text
web/src/lib/
├─ nostr/
│  ├─ protocol/
│  ├─ relay/
│  ├─ signing/
│  └─ verification/
├─ features/
│  └─ <feature>/
│     ├─ domain/
│     ├─ application/
│     └─ presentation/
├─ platform/
│  ├─ storage/
│  └─ browser/
└─ components/
```

Directories should be created only when they represent a meaningful responsibility. Do not create empty layers or abstractions only to match this structure.

## Responsibilities

### `nostr/protocol`

Pure Nostr and NIP semantics, such as parsing, validation, classification, reference generation, and deterministic transformations.

NIP modules belong here and must not depend on Svelte, application state, relay clients, signing implementations, storage, or browser APIs.

### `nostr/relay`

Communication with Nostr relays, including subscriptions, fetching, publishing, and connection handling.

Concrete relay libraries such as `rx-nostr` belong here.

### `nostr/signing`

Nostr signing and cryptographic capabilities, including signer backends and NIP-specific encryption.

### `nostr/verification`

Concrete event verification implementations and services.

### `features/<feature>`

Product behavior is organized by feature.

- `domain`: pure feature rules and transformations
- `application`: use cases, orchestration, and application state
- `presentation`: feature-specific UI and presentation state

State belongs to the feature or capability that owns its meaning. Being a Svelte store is not a reason to place state in a global store directory.

### `platform`

Runtime capabilities that are neither Nostr-specific nor feature-specific, such as storage and browser APIs.

### `components`

Reusable UI components that are not owned by a specific feature.

## Dependency direction

Dependencies should flow toward lower-level, more stable logic:

```text
presentation
    ↓
application
    ↓
domain
    ↓
nostr/protocol
```

Application code may also use:

```text
nostr/relay
nostr/signing
nostr/verification
platform/*
```

Lower-level modules must not depend on product features or presentation.

Avoid circular dependencies.

## Migration

The current codebase does not need to be reorganized at once.

- New code should follow this architecture where practical.
- Existing code should move toward it through focused refactoring.
- Avoid unrelated large-scale moves.
- Prefer separating architectural changes from behavior changes.
- Do not preserve obsolete boundaries with unnecessary wrappers or re-exports.
