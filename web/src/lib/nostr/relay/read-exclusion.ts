import { rxNostr } from '$lib/relay-client';
import type { RelayEntry } from '$lib/nostr/protocol/nip65';

// Only relays whose intended read permission is true enter this set.
const excluded = new Set<string>();

export function clearReadExclusions(): void {
	excluded.clear();
}

export function getRelaysForPublication(): Record<string, RelayEntry> {
	return Object.fromEntries(
		Object.entries(rxNostr.getDefaultRelays()).map(([url, relay]) => [
			url,
			{ ...relay, read: relay.read || excluded.has(relay.url) }
		])
	);
}

export function withReadExclusions(relays: RelayEntry[]): RelayEntry[] {
	for (const url of excluded) {
		if (!rxNostr.getDefaultRelay(url)) {
			excluded.delete(url);
		}
	}
	return relays.map((relay) => {
		const previousUrl = rxNostr.getDefaultRelay(relay.url)?.url ?? relay.url;
		const wasExcluded = excluded.delete(previousUrl);
		const state = rxNostr.getRelayStatus(relay.url)?.connection;
		if (
			relay.read &&
			(wasExcluded || state === 'waiting-for-retrying' || state === 'retrying')
		) {
			excluded.add(relay.url);
			return { ...relay, read: false };
		}
		return { ...relay };
	});
}

rxNostr.createConnectionStateObservable().subscribe(({ from, state }) => {
	const relay = rxNostr.getDefaultRelay(from);
	if (!relay) {
		return;
	}
	if (state === 'waiting-for-retrying' && relay.read) {
		excluded.add(relay.url);
		rxNostr.setDefaultRelays({
			...rxNostr.getDefaultRelays(),
			[relay.url]: { ...relay, read: false }
		});
	} else if (state === 'connected' || state === 'error' || state === 'rejected') {
		if (excluded.delete(relay.url)) {
			rxNostr.setDefaultRelays({
				...rxNostr.getDefaultRelays(),
				[relay.url]: { ...relay, read: true }
			});
		}
	}
});
