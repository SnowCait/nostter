import { createRxOneshotReq, latest, now } from 'rx-nostr';
import { every, firstValueFrom, EmptyError } from 'rxjs';
import { get } from 'svelte/store';
import type { EventTemplate } from 'nostr-tools';
import { PublicChatsList } from 'nostr-tools/kinds';
import { authorChannelsEventStore } from '$lib/cache/Events';
import { Signer } from '$lib/Signer';
import { pubkey } from '$lib/stores/Author';
import { rxNostr, tie } from '$lib/timelines/MainTimeline';

async function fetchPinnedChannelsEvent(): Promise<EventTemplate | undefined> {
	const req = createRxOneshotReq({
		filters: { kinds: [PublicChatsList], authors: [get(pubkey)], limit: 1 }
	});
	try {
		const packet = await firstValueFrom(rxNostr.use(req).pipe(tie, latest()));
		return packet.event;
	} catch (error) {
		if (error instanceof EmptyError) {
			return undefined;
		}
		throw error;
	}
}

function send(unsignedEvent: EventTemplate, failureMessage: string): Promise<void> {
	return Signer.signEvent(unsignedEvent).then((event) => {
		const observable = rxNostr.send(event);
		observable.subscribe((packet) => {
			if (packet.ok && get(authorChannelsEventStore)?.id !== event.id) {
				authorChannelsEventStore.set(event);
			}
		});
		observable.pipe(every((packet) => !packet.ok)).subscribe((failed) => {
			if (failed) {
				console.error('[channel pin send failed]', event);
				alert(failureMessage);
			}
		});
	});
}

export async function pinChannel(channelId: string): Promise<void> {
	const latestEvent = await fetchPinnedChannelsEvent();
	if (latestEvent?.tags.some(([tagName, id]) => tagName === 'e' && id === channelId) === true) {
		return;
	}

	await send(
		{
			kind: PublicChatsList,
			content: latestEvent?.content ?? '',
			tags: [...(latestEvent?.tags ?? []), ['e', channelId]],
			created_at: now()
		},
		'Failed to pin.'
	);
}

export async function unpinChannel(channelId: string): Promise<void> {
	const latestEvent = await fetchPinnedChannelsEvent();
	if (latestEvent === undefined) {
		return;
	}
	if (!latestEvent.tags.some(([tagName, id]) => tagName === 'e' && id === channelId)) {
		return;
	}

	await send(
		{
			kind: latestEvent.kind,
			content: latestEvent.content,
			tags: latestEvent.tags.filter(
				([tagName, id]) => !(tagName === 'e' && id === channelId)
			),
			created_at: now()
		},
		'Failed to unpin.'
	);
}
