import { get, writable, type Writable } from 'svelte/store';
import { createRxOneshotReq, latest, uniq } from 'rx-nostr';
import { filter, lastValueFrom } from 'rxjs';
import { notificationsFilterKinds } from '$lib/Constants';
import { EventItem } from '$lib/Items';
import { author, pubkey } from '$lib/stores/Author';
import { rxNostr, tie } from '$lib/timelines/MainTimeline';

export const notifiedEventItems: Writable<EventItem[]> = writable([]);
export const lastReadAt: Writable<number> = writable(0);

export async function fetchLastNotification(): Promise<void> {
	const $pubkey = get(pubkey);
	const $author = get(author);
	if ($author === undefined) {
		return;
	}

	const notificationExistsReq = createRxOneshotReq({
		filters: [
			{
				kinds: notificationsFilterKinds,
				'#p': [$pubkey],
				limit: 10
			}
		]
	});
	try {
		const { event } = await lastValueFrom(
			rxNostr.use(notificationExistsReq).pipe(
				tie,
				uniq(),
				filter(({ event }) => $author.isNotified(event)),
				latest()
			)
		);
		console.debug('[rx-nostr last notification]', event, new Date(event.created_at * 1000));
		const $notifiedEventItems = get(notifiedEventItems);
		if (!$notifiedEventItems.some((item) => item.event.id === event.id)) {
			$notifiedEventItems.unshift(new EventItem(event));
			notifiedEventItems.set($notifiedEventItems);
		}
	} catch (error) {
		console.debug('[rx-nostr last notification not found]', error);
	}
}
