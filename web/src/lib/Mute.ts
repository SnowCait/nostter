import { get } from 'svelte/store';
import type { Event } from 'nostr-tools';
import { Signer } from './Signer';
import { pubkey, storeMutedTagsByEvent } from './stores/Author';
import { decryptListContent } from './List';
import { sendEvent } from './RxNostrHelper';

export class Mute {
	private readonly authorPubkey = get(pubkey);
	private readonly kind = 10000;

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
		const migratedEvent = await sendEvent(this.kind, content, publicTags);
		await storeMutedTagsByEvent(migratedEvent);
	}
}
