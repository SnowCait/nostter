import { get, writable, type Writable } from 'svelte/store';
import { createRxOneshotReq, latest, uniq } from 'rx-nostr';
import { filter, lastValueFrom } from 'rxjs';
import { notificationsFilterKinds } from '$lib/Constants';
import { EventItem } from '$lib/Items';
import { rxNostr, tie } from '$lib/timelines/MainTimeline';
import { auth } from '$lib/auth.svelte';
import { isNotifiedEvent } from '$lib/features/notifications/application/is-notified-event';

export const notifiedEventItems: Writable<EventItem[]> = writable([]);
export const lastReadAt: Writable<number> = writable(0);

export async function fetchLastNotification(): Promise<void> {
	const accountPubkey = auth.pubkey;
	if (accountPubkey === undefined) {
		return;
	}

	const notificationExistsReq = createRxOneshotReq({
		filters: [
			{
				kinds: notificationsFilterKinds,
				'#p': [accountPubkey],
				limit: 10
			}
		]
	});
	try {
		const { event } = await lastValueFrom(
			rxNostr.use(notificationExistsReq).pipe(
				tie,
				uniq(),
				filter(({ event }) => isNotifiedEvent(event, accountPubkey)),
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
