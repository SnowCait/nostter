import type { Event } from 'nostr-tools';
import { createRxBackwardReq, latestEach, uniq } from 'rx-nostr';
import { RelayList } from './author/RelayList';
import { findIdentifier } from './nostr/protocol/event-address';
import { WebStorage } from './WebStorage';
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
		const storage = new WebStorage(localStorage);
		const cachedAt = storage.getCachedAt();
		if (cachedAt !== null && storage.getCachedAccountPubkey() === pubkey) {
			console.log('[cached at]', new Date(cachedAt * 1000));
			const replaceableEvents = new Map(
				authorReplaceableKinds
					.filter(({ identifier }) => identifier === undefined)
					.map(({ kind }) => [kind, storage.getReplaceableEvent(kind)])
					.filter((x): x is [number, Event] => x[1] !== undefined)
			);
			console.log('[author events cache re]', replaceableEvents);
			const parameterizedReplaceableEvents = new Map(
				[
					...authorReplaceableKinds.filter(({ identifier }) => identifier !== undefined),
					...storage.getParameterizedIdentifiers(30007).map((identifier) => ({
						kind: 30007,
						identifier
					}))
				]
					.map(({ kind, identifier }) => {
						if (identifier === undefined) {
							throw new Error('Logic error');
						}
						return [
							`${kind}:${identifier}`,
							storage.getParameterizedReplaceableEvent(kind, identifier)
						];
					})
					.filter((x): x is [string, Event] => x[1] !== undefined)
			);
			console.log('[author events cache pre]', parameterizedReplaceableEvents);
			if (
				[...replaceableEvents.values(), ...parameterizedReplaceableEvents.values()].every(
					(event) => event.pubkey === pubkey
				)
			) {
				return { replaceableEvents, parameterizedReplaceableEvents };
			}
		}

		console.log('[cached at]', cachedAt);

		const { replaceableEvents, parameterizedReplaceableEvents } =
			await this.fetchAuthorEvents(pubkey);
		for (const [, event] of [...replaceableEvents]) {
			storage.setReplaceableEvent(event, pubkey);
		}
		for (const [, event] of [...parameterizedReplaceableEvents]) {
			storage.setParameterizedReplaceableEvent(event, pubkey);
		}
		return { replaceableEvents, parameterizedReplaceableEvents };
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
