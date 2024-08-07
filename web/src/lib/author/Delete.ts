import { get } from 'svelte/store';
import { now } from 'rx-nostr';
import type { Event } from 'nostr-typedef';
import { pubkey as authorPubkey } from '$lib/stores/Author';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { Signer } from '$lib/Signer';

export async function deleteEvent(events: Event[], reason = ''): Promise<void> {
	if (events.length === 0) {
		return;
	}

	const $authorPubkey = get(authorPubkey);
	if (events.some((event) => event.pubkey !== $authorPubkey)) {
		console.error('[delete logic error]', events);
		return;
	}

	const event = await Signer.signEvent({
		kind: 5,
		pubkey: $authorPubkey,
		content: reason,
		tags: [
			...events.map((event) => ['e', event.id]),
			...[...new Set(events.map((event) => event.kind))].map((kind) => ['k', `${kind}`])
		],
		created_at: now()
	});
	rxNostr.send(event).subscribe(({ eventId, from, ok }) => {
		console.debug('[delete send]', eventId, from, ok);
	});
}
