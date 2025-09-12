import { now } from 'rx-nostr';
import type { Event } from 'nostr-typedef';
import { reactionedEvents, updateReactionedEvents } from './Action';
import { getRelayHint, rxNostr, seenOn } from '$lib/timelines/MainTimeline';
import { Signer } from '$lib/Signer';
import { deleteEvent } from './Delete';
import { sortEvents } from 'nostr-tools';
import { get } from 'svelte/store';

export async function sendReaction(
	target: Event,
	content: string,
	emojiUrl: string | undefined
): Promise<void> {
	const relay = getRelayHint(target.id);
	const tags = [
		['e', target.id, relay ?? '', target.pubkey],
		['p', target.pubkey],
		['k', String(target.kind)]
	];

	if (emojiUrl !== undefined && /^:.+:$/.test(content)) {
		tags.push(['emoji', content.replaceAll(':', ''), emojiUrl]);
	}

	const event = await Signer.signEvent({
		kind: 7,
		content,
		tags,
		created_at: now()
	});
	console.debug('[reaction event]', event, seenOn.get(target.id));

	rxNostr.send(event).subscribe(({ from, ok }) => console.debug('[reaction send]', from, ok));
	updateReactionedEvents([event]);
}

export function deleteReaction(target: Event): void {
	const $reactionedEvents = get(reactionedEvents);
	const events = $reactionedEvents.get(target.id);
	if (events === undefined || events.length === 0) {
		return;
	}

	const sortedEvents = sortEvents(events);
	deleteEvent(sortedEvents.slice(0, 1));
	$reactionedEvents.set(target.id, sortedEvents.slice(1));
	reactionedEvents.set($reactionedEvents);
}
