import type { RxNostr } from 'rx-nostr';
import type { RelayEntry } from '$lib/nostr/protocol/nip65';

export function createRelayReadExclusion(client: RxNostr) {
	let excluded = new Set<string>();
	const set = (relays: RelayEntry[]) => {
		const next = relays.map((relay) => ({ ...relay }));
		excluded = new Set(
			next
				.filter(
					(relay) =>
						relay.read &&
						(excluded.has(client.getDefaultRelay(relay.url)?.url ?? relay.url) ||
							['waiting-for-retrying', 'retrying'].includes(
								client.getRelayStatus(relay.url)?.connection ?? ''
							))
				)
				.map((relay) => relay.url)
		);
		client.setDefaultRelays(
			next.map((relay) => ({ ...relay, read: relay.read && !excluded.has(relay.url) }))
		);
	};
	client.createConnectionStateObservable().subscribe(({ from, state }) => {
		const relay = client.getDefaultRelay(from);
		if (!relay) {
			return;
		}
		if (state === 'waiting-for-retrying' && relay.read && !excluded.has(relay.url)) {
			excluded.add(relay.url);
			client.setDefaultRelays({
				...client.getDefaultRelays(),
				[relay.url]: { ...relay, read: false }
			});
		} else if (state === 'connected' || state === 'error' || state === 'rejected') {
			if (excluded.delete(relay.url)) {
				client.setDefaultRelays({
					...client.getDefaultRelays(),
					[relay.url]: { ...relay, read: true }
				});
			}
		}
	});
	return {
		set,
		add(relay: RelayEntry) {
			const previous = client.getDefaultRelay(relay.url)?.url;
			const current = Object.values(client.getDefaultRelays())
				.filter((entry) => entry.url !== previous)
				.map((entry) => ({ ...entry, read: entry.read || excluded.has(entry.url) }));
			set([...current, relay]);
		},
		reset(relays: RelayEntry[]) {
			excluded.clear();
			set(relays);
		}
	};
}
