import { get, writable, type Writable } from 'svelte/store';
import { createRxOneshotReq } from 'rx-nostr';
import { lastValueFrom } from 'rxjs';
import { notificationsFilterKinds } from '$lib/Constants';
import { EventItem } from '$lib/Items';
import { pubkey } from '$lib/stores/Author';
import { rxNostr } from '$lib/timelines/MainTimeline';

export const notifiedEventItems: Writable<EventItem[]> = writable([]);
export const lastReadAt: Writable<number> = writable(0);

export async function fetchLastNotification(): Promise<void> {
	const $pubkey = get(pubkey);
	const notificationExistsReq = createRxOneshotReq({
		filters: [
			{
				kinds: notificationsFilterKinds,
				'#p': [$pubkey],
				limit: 1
			}
		]
	});
	try {
		const { event } = await lastValueFrom(rxNostr.use(notificationExistsReq));
		console.debug('[rx-nostr last notification]', event, new Date(event.created_at * 1000));
		const $notifiedEventItems = get(notifiedEventItems);
		if (!$notifiedEventItems.some((item) => item.event.id === event.id)) {
			$notifiedEventItems.unshift(new EventItem(event));
		}
	} catch (error) {
		console.debug('[rx-nostr last notification not found]', error);
	}
}
