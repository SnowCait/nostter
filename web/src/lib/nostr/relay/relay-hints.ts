import { createTie } from '$lib/RxNostrTie';

export const [tie, seenOn] = createTie();

export function getRelayHint(id: string): string | undefined {
	return seenOn
		.get(id)
		?.values()
		.filter((value) => value.startsWith('wss://'))
		.next().value;
}

export function getSeenOnRelays(id: string): string[] | undefined {
	const relays = seenOn.get(id);
	if (relays === undefined) {
		return undefined;
	}
	return [...relays].filter((value) => value.startsWith('wss://'));
}
