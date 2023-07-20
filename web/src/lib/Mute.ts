import { get } from 'svelte/store';
import type { Event, Kind, SimplePool } from 'nostr-tools';
import { Api } from './Api';
import { Signer } from './Signer';
import { muteEventIds, mutePubkeys, muteWords } from '../stores/Author';
import { filterTags } from './EventHelper';

export class Mute {
	private readonly api: Api;
	private readonly kind = 10000 as Kind;

	constructor(private readonly authorPubkey: string, pool: SimplePool, writeRelays: string[]) {
		this.api = new Api(pool, writeRelays);
	}

	public async muteWord(word: string): Promise<void> {
		const muteList = await this.api.fetchEvent([
			{
				kinds: [this.kind],
				authors: [this.authorPubkey],
				limit: 1
			}
		]);
		console.log('[mute list]', muteList);

		let privateTags: string[][] = [];
		if (muteList !== undefined) {
			privateTags = await this.parseContent(muteList.content);

			if (
				[...muteList.tags, ...privateTags].some(
					([tagName, w]) => tagName === 'word' && w === word
				)
			) {
				console.log('[already mute]', word, muteList);
				return;
			}

			privateTags.push(['word', word]);
		} else {
			privateTags = [['word', word]];
		}

		const content = await Signer.encrypt(this.authorPubkey, JSON.stringify(privateTags));
		await this.api.signAndPublish(this.kind, content, muteList?.tags ?? []);
	}

	public async unmuteWord(word: string): Promise<void> {
		const muteList = await this.api.fetchEvent([
			{
				kinds: [this.kind],
				authors: [this.authorPubkey],
				limit: 1
			}
		]);
		console.log('[mute list]', muteList);

		if (muteList === undefined) {
			console.log('[no mute list]', word);
			return;
		}

		let privateTags: string[][] = await this.parseContent(muteList.content);

		const tags = muteList.tags.filter(([tagName, w]) => tagName !== 'word' || w !== word);
		privateTags = privateTags.filter(([tagName, w]) => tagName !== 'word' || w !== word);

		const content =
			privateTags.length > 0
				? await Signer.encrypt(this.authorPubkey, JSON.stringify(privateTags))
				: '';
		await this.api.signAndPublish(this.kind, content, tags);
	}

	public async update(event: Event) {
		const privateTags: string[][] = await this.parseContent(event.content);

		// mutePubkeys.set([...filterTags('p', event.tags), ...filterTags('p', privateTags)]);
		// muteEventIds.set([...filterTags('e', event.tags), ...filterTags('e', privateTags)]);
		muteWords.set([...filterTags('word', event.tags), ...filterTags('word', privateTags)]);
		console.log('[mute lists]', get(mutePubkeys), get(muteEventIds), get(muteWords));
	}

	// For regacy clients
	public async migrate(regacyEvent: Event, event: Event | undefined): Promise<void> {
		console.log('[migrate mute]', regacyEvent, event);

		const regacyPublicTags = regacyEvent.tags.filter(([name]) => name !== 'd');
		const publicTags = event?.tags ?? [];

		const regacyPrivateTags = await this.parseContent(regacyEvent.content);
		const privateTags = await this.parseContent(event?.content ?? '');

		const regacyTags = [...regacyPublicTags, ...regacyPrivateTags];
		const tags = [...publicTags, ...privateTags];

		if (
			regacyTags.every(([name, content]) =>
				tags.some(([n, c]) => n === name && c === content)
			)
		) {
			console.log('[no need to migrate]');
			return;
		}

		privateTags.push(
			...regacyPrivateTags.filter(
				([name, content]) => !privateTags.some(([n, c]) => n === name && c === content)
			)
		);
		publicTags.push(
			...regacyPublicTags.filter(
				([name, content]) => !publicTags.some(([n, c]) => n === name && c === content)
			)
		);

		const content =
			privateTags.length > 0
				? await Signer.encrypt(this.authorPubkey, JSON.stringify(privateTags))
				: '';
		await this.api.signAndPublish(10000 as Kind, content, publicTags);
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
