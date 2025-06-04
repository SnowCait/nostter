import { now } from 'rx-nostr';
import type { Event } from 'nostr-typedef';
import { updateReactionedEvents } from './Action';
import { getRelayHint, rxNostr, seenOn } from '$lib/timelines/MainTimeline';
import { Signer } from '$lib/Signer';

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
