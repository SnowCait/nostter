import { rxNostr } from '$lib/relay-client';

// Only relays whose intended read permission is true enter this set.
const excluded = new Set<string>();

export function clearReadExclusions(): void {
	excluded.clear();
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
