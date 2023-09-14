import { get } from 'svelte/store';
import type { Event, Kind, SimplePool } from 'nostr-tools';
import { Api } from './Api';
import { Signer } from './Signer';
import { muteEventIds, mutePubkeys, muteWords } from '../stores/Author';
import { filterTags } from './EventHelper';
import { authorReplaceableEvents } from './cache/Events';

export class Mute {
	private readonly api: Api;
	private readonly kind = 10000 as Kind;

	constructor(private readonly authorPubkey: string, pool: SimplePool, writeRelays: string[]) {
		this.api = new Api(pool, writeRelays);
	}

	public async mutePrivate(tagName: string, tagContent: string): Promise<void> {
		const muteList = await this.fetchLatestEvent();

		let privateTags: string[][] = [];
		if (muteList !== undefined) {
			privateTags = await this.parseContent(muteList.content);

			if (
				[...muteList.tags, ...privateTags].some(
					([t, w]) => t === tagName && w === tagContent
				)
			) {
				console.log('[already mute]', tagName, tagContent, privateTags);
				return;
			}

			privateTags.push([tagName, tagContent]);
		} else {
			privateTags = [[tagName, tagContent]];
		}

		const content = await Signer.encrypt(this.authorPubkey, JSON.stringify(privateTags));
		await this.api.signAndPublish(this.kind, content, muteList?.tags ?? []);
	}

	public async unmutePrivate(tagName: string, tagContent: string): Promise<void> {
		const muteList = await this.fetchLatestEvent();

		if (muteList === undefined) {
			console.log('[no mute list]', tagName, tagContent);
			return;
		}

		const beforePrivateTags: string[][] = await this.parseContent(muteList.content);

		const publicTags = muteList.tags.filter(([t, w]) => t !== tagName || w !== tagContent);
		const privateTags = beforePrivateTags.filter(([t, w]) => t !== tagName || w !== tagContent);

		const content =
			privateTags.length > 0
				? await Signer.encrypt(this.authorPubkey, JSON.stringify(privateTags))
				: '';
		await this.api.signAndPublish(this.kind, content, publicTags);
	}

	private async fetchLatestEvent() {
		const muteList = await this.api.fetchEvent([
			{
				kinds: [this.kind],
				authors: [this.authorPubkey],
				limit: 1
			}
		]);
		console.log('[mute list]', muteList);

		// Validation
		const cache = authorReplaceableEvents.get(10000);
		if (
			muteList !== undefined &&
			cache !== undefined &&
			muteList.created_at < cache.created_at
		) {
			throw new Error('Fetched event is older than cache.');
		}

		return muteList;
	}

	public async update(event: Event): Promise<void> {
		const privateTags: string[][] = await this.parseContent(event.content);

		mutePubkeys.set([...filterTags('p', event.tags), ...filterTags('p', privateTags)]);
		muteEventIds.set([...filterTags('e', event.tags), ...filterTags('e', privateTags)]);
		muteWords.set([...filterTags('word', event.tags), ...filterTags('word', privateTags)]);
		console.log(
			'[mute lists]',
			'p',
			get(mutePubkeys),
			'e',
			get(muteEventIds),
			'word',
			get(muteWords)
		);
	}

	// For legacy clients
	public async migrate(legacyEvent: Event, event: Event | undefined): Promise<void> {
		console.log('[migrate mute]', legacyEvent, event);

		const legacyPublicTags = legacyEvent.tags.filter(([name]) => name !== 'd');
		const publicTags = event?.tags ?? [];

		const legacyPrivateTags = await this.parseContent(legacyEvent.content);
		const privateTags = await this.parseContent(event?.content ?? '');

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
		await this.update(migratedEvent);
	}

	private async parseContent(content: string): Promise<string[][]> {
		if (content === '') {
			return [];
		}

		try {
			const json = await Signer.decrypt(this.authorPubkey, content);
			return JSON.parse(json);
		} catch (error) {
			console.error('[mute list parse error]', error);
			return [];
		}
	}
}
