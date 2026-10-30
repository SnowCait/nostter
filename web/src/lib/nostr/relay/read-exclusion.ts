import { rxNostr } from '$lib/relay-client';

// Only relays whose intended read permission is true enter this set.
const excluded = new Set<string>();

export function clearReadExclusions(): void {
	excluded.clear();
}

export function restoreReadExclusions(): void {
	const relays = rxNostr.getDefaultRelays();
	let changed = false;
	for (const url of excluded) {
		const relay = relays[url];
		if (relay && !relay.read) {
			relays[url] = { ...relay, read: true };
			changed = true;
		}
	}
	excluded.clear();
	if (changed) {
		rxNostr.setDefaultRelays(relays);
	}
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
