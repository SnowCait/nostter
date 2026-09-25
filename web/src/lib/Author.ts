import type { Event } from 'nostr-tools';
import { createRxBackwardReq, latestEach, uniq } from 'rx-nostr';
import { RelayList } from './author/RelayList';
import { findIdentifier } from './nostr/protocol/event-address';
import { accountAddressableEventCache, cacheAccountEvent } from './cache/Events';
import { rxNostr, tie } from './timelines/MainTimeline';
import {
	authorReplaceableKinds,
	parameterizedReplaceableKinds,
	replaceableKinds
} from './Constants';

export type LoadedAccountEvents = {
	replaceableEvents: Map<number, Event>;
	parameterizedReplaceableEvents: Map<string, Event>;
};

export class Author {
	constructor(private pubkey: string) {}

	public async fetchRelays() {
		const relayEvents = await RelayList.fetchEvents(this.pubkey);
		console.log('[relay events]', relayEvents);

		RelayList.apply(relayEvents);
	}

	public fetchEvents(): Promise<LoadedAccountEvents> {
		return this.fetchAuthorEventsWithCache(this.pubkey);
	}

	private async fetchAuthorEventsWithCache(pubkey: string): Promise<LoadedAccountEvents> {
		const cached = await Promise.all(
			authorReplaceableKinds.map(async ({ kind, identifier }) => ({
				kind,
				identifier,
				event: await accountAddressableEventCache.get(pubkey, kind, identifier ?? '')
			}))
		);
		const replaceableEvents = new Map<number, Event>();
		const parameterizedReplaceableEvents = new Map<string, Event>();
		for (const { kind, identifier, event } of cached) {
			if (event === undefined) continue;
			if (identifier === undefined) replaceableEvents.set(kind, event);
			else parameterizedReplaceableEvents.set(`${kind}:${identifier}`, event);
		}
		if (replaceableEvents.size + parameterizedReplaceableEvents.size > 0) {
			return { replaceableEvents, parameterizedReplaceableEvents };
		}

		const fetched = await this.fetchAuthorEvents(pubkey);
		for (const event of [
			...fetched.replaceableEvents.values(),
			...fetched.parameterizedReplaceableEvents.values()
		]) {
			await cacheAccountEvent(event);
		}
		return fetched;
	}

	private async fetchAuthorEvents(pubkey: string) {
		const replaceableEvents = new Map<number, Event>();
		const parameterizedReplaceableEvents = new Map<string, Event>();
		await new Promise<void>((resolve, reject) => {
			const authorReq = createRxBackwardReq();
			rxNostr
				.use(authorReq)
				.pipe(
					tie,
					uniq(),
					latestEach(({ event }) => `${event.kind}:${findIdentifier(event.tags) ?? ''}`)
				)
				.subscribe({
					next: (packet) => {
						console.log('[rx-nostr author]', packet);
						const { event } = packet;
						if (replaceableKinds.includes(event.kind)) {
							replaceableEvents.set(event.kind, event);
						} else if (parameterizedReplaceableKinds.includes(event.kind)) {
							parameterizedReplaceableEvents.set(
								`${event.kind}:${findIdentifier(event.tags) ?? ''}`,
								event
							);
						} else {
							console.error('[rx-nostr author logic error]', packet);
						}
					},
					complete: () => {
						console.log('[rx-nostr author complete]');
						resolve();
					},
					error: (error) => {
						console.error('[rx-nostr author error]', error);
						reject();
					}
				});
			authorReq.emit([
				{
					kinds: [...replaceableKinds, ...parameterizedReplaceableKinds],
					authors: [pubkey]
				}
			]);
			authorReq.over();
		});
		return { replaceableEvents, parameterizedReplaceableEvents };
	}
}
