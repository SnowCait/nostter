import type { RxNostr } from 'rx-nostr';
import type { RelayEntry } from '$lib/nostr/protocol/nip65';

/** User preferences stay separate from the temporary read exclusion applied to rx-nostr. */
export function createDefaultRelaySettings(client: RxNostr) {
	let intended: RelayEntry[] = [];
	let excluded = new Set<string>();
	const apply = () =>
		client.setDefaultRelays(
			intended.map((relay) => ({
				...relay,
				read: relay.read && !excluded.has(relay.url)
			}))
		);
	client.createConnectionStateObservable().subscribe(({ from, state }) => {
		// Let rx-nostr resolve URL aliases rather than duplicating its normalization.
		const url = client.getDefaultRelay(from)?.url;
		if (url === undefined) {
			return;
		}
		const relay = intended.find((entry) => entry.url === url);
		if (!relay) {
			return;
		}
		if (state === 'waiting-for-retrying') {
			if (!relay.read || excluded.has(url)) {
				return;
			}
			excluded.add(url);
			apply();
		} else if (state === 'connected' || state === 'error' || state === 'rejected') {
			if (excluded.delete(url)) {
				apply();
			}
		}
	});
	return {
		set(relays: (string | RelayEntry)[]) {
			const next = relays.map((relay) =>
				typeof relay === 'string' ? { url: relay, read: true, write: true } : { ...relay }
			);
			excluded = new Set(
				next
					.filter((relay) =>
						excluded.has(client.getDefaultRelay(relay.url)?.url ?? relay.url)
					)
					.map((relay) => relay.url)
			);
			intended = next;
			apply();
		},
		add(relay: RelayEntry) {
			const previousUrl = client.getDefaultRelay(relay.url)?.url;
			this.set([
				...intended.filter((entry) => entry.url !== previousUrl && entry.url !== relay.url),
				relay
			]);
		},
		get(): Record<string, RelayEntry> {
			return Object.fromEntries(intended.map((relay) => [relay.url, { ...relay }]));
		},
		reset(relays: (string | RelayEntry)[]) {
			excluded.clear();
			this.set(relays);
		}
	};
}
