# @nostter/nostr-protocol

NIP-based protocol logic for Nostr clients.  
This ESM package supports Node.js and browsers and includes TypeScript declarations.

For application-independent utilities, see [@nostter/nostr-kit](https://github.com/SnowCait/nostter/blob/main/packages/nostr-kit/README.md).

## Installation

```sh
npm install @nostter/nostr-protocol
```

## Public API

```ts
import { shouldReplaceCurrentEvent } from '@nostter/nostr-protocol';
import type { Event } from 'nostr-tools';

declare const candidate: Event;
declare const current: Event | undefined;

if (shouldReplaceCurrentEvent(candidate, current)) {
	// Store candidate as the current event for this replacement key.
}
```

`shouldReplaceCurrentEvent(candidate: Event, current: Event | undefined): boolean` applies the replacement ordering from [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md#kinds), using `nostr-tools`' `compareEvents`.
It returns `true` if there is no current event or the candidate is newer. If timestamps match, the lexicographically smaller ID wins. Comparing an event with itself returns `false`.

The function works for both replaceable and addressable events. Callers must compare events sharing the same replacement key:

- Replaceable events: `pubkey` + `kind`.
- Addressable events: `pubkey` + `kind` + `d` tag value.

Grouping events by key is the caller's responsibility. The function does not validate keys, kinds, tags, signatures, or events.

## Development and distribution

From the repository root:

```sh
npm ci
npm run build -w @nostter/nostr-protocol
npm test -w @nostter/nostr-protocol
npm run lint -w @nostter/nostr-protocol
npm pack -w @nostter/nostr-protocol --dry-run
```

From the package directory, use `npm run build` and `npm test`.
The `prepare` hook builds the package during installation and packaging. Rebuild after source changes; do not commit `dist`.
The npm package includes only JavaScript, declarations, README, LICENSE, and package.json.

## License

MIT. See [LICENSE](./LICENSE).
