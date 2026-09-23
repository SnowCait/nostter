import type * as Nostr from 'nostr-typedef';
import { isMuteEvent } from '$lib/stores/Author';
import { isNotificationEvent } from '../domain/is-notification-event';

export function isNotifiedEvent(event: Nostr.Event, accountPubkey: string): boolean {
	return isNotificationEvent(event, accountPubkey) && !isMuteEvent(event);
}
