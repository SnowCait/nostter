# @nostter/nostr-kit

Application-independent utilities shared by Nostr clients.
The package currently provides relay URL validation. It is an ESM package for Node.js and browsers, with JavaScript and TypeScript declarations included.

## Installation

```sh
npm install @nostter/nostr-kit
```

## Public API

```ts
import { isRelayUrl, isSecureRelayUrl, isPublicRelayUrl } from '@nostter/nostr-kit';

isRelayUrl('ws://localhost:8080'); // true
isSecureRelayUrl('wss://127.0.0.1'); // true
isPublicRelayUrl('wss://127.0.0.1'); // false
isPublicRelayUrl('wss://relay.example.com'); // true

const value: unknown = 'wss://relay.example.com';
if (isRelayUrl(value)) {
	// value is narrowed to string.
	console.log(value);
}
```

All three functions are type guards with the signature `(value: unknown): value is string`.

| Function             | Validation                                                                                                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isRelayUrl()`       | Accepts `ws:` / `wss:` URLs without fragments, including local relays.                                                                                                                                                           |
| `isSecureRelayUrl()` | Applies the `isRelayUrl()` checks and requires `wss:`. Local relays are still allowed.                                                                                                                                           |
| `isPublicRelayUrl()` | Requires `wss:`, no credentials, and a host that is neither a local hostname nor a non-public IP address. Classifies IANA special-purpose addresses and globally reachable exceptions, including forms such as IPv4-mapped IPv6. |

`isPublicRelayUrl()` implements a client-side connection policy for accepting externally supplied relay hints as connection candidates.
It is not a Nostr protocol requirement. It does not resolve DNS or check reachability, so it does not guarantee that a hostname resolves to a public IP address.
Choose the appropriate function for your use case, such as explicitly configured local relays. Invalid URLs and non-string values return `false`.

## Development and distribution

Run these commands from the repository root:

```sh
npm ci
npm run build -w @nostter/nostr-kit
npm test -w @nostter/nostr-kit
npm pack -w @nostter/nostr-kit
```

The `prepare` hook builds the package during `npm ci` / `npm install`, generating the `dist` files used by web.
Rebuild after changing the source. For continuous development, use `npm run build -w @nostter/nostr-kit -- --watch`.
From the package directory, run `npm run build` / `npm test`.
`npm pack` also builds through `prepare` and includes only JavaScript, declarations, README, LICENSE, and package.json.
Do not commit `dist`. Before publishing to npm, install the tarball in a separate project and verify the public API.

## License

MIT. See [LICENSE](./LICENSE).
