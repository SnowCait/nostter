import { filterAsync } from 'rx-nostr';
import type * as Nostr from 'nostr-typedef';
import { cacheAccountEvent } from './Events';

export function filterAndCacheNewerAccountEvents<T extends { event: Nostr.Event }>() {
	return filterAsync<T>(({ event }) => cacheAccountEvent(event));
}
