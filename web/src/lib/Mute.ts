import { get } from 'svelte/store';
import type { Event, Kind } from 'nostr-tools';
import { Api } from './Api';
import { Signer } from './Signer';
import { pubkey, storeMutedTagsByEvent, writeRelays } from './stores/Author';
import { pool } from './stores/Pool';
import { decryptListContent } from './List';

export class Mute {
	private readonly authorPubkey = get(pubkey);
	private readonly api: Api;
	private readonly kind = 10000 as Kind;

	constructor() {
		this.api = new Api(get(pool), get(writeRelays));
	}

	// For legacy clients
	public async migrate(legacyEvent: Event, event: Event | undefined): Promise<void> {
		console.log('[migrate mute]', legacyEvent, event);

		const legacyPublicTags = legacyEvent.tags.filter(([name]) => name !== 'd');
		const publicTags = event?.tags ?? [];

		const legacyPrivateTags = await decryptListContent(legacyEvent.content);
		const privateTags = await decryptListContent(event?.content ?? '');

		const legacyTags = [...legacyPublicTags, ...legacyPrivateTags];
		const tags = [...publicTags, ...privateTags];

		if (
			legacyTags.every(([name, content]) =>
				tags.some(([n, c]) => n === name && c === content)
			)
		) {
			console.log('[no need to migrate]');
			return;
		}

		privateTags.push(
			...legacyPrivateTags.filter(
				([name, content]) => !privateTags.some(([n, c]) => n === name && c === content)
			)
		);
		publicTags.push(
			...legacyPublicTags.filter(
				([name, content]) => !publicTags.some(([n, c]) => n === name && c === content)
			)
		);

		const content =
			privateTags.length > 0
				? await Signer.encrypt(this.authorPubkey, JSON.stringify(privateTags))
				: '';
		const migratedEvent = await this.api.signAndPublish(10000 as Kind, content, publicTags);
		await storeMutedTagsByEvent(migratedEvent);
	}
}
