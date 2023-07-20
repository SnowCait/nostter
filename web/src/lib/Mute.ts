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

		let privateTags: string[][];
		if (muteList !== undefined) {
			const json = await Signer.decrypt(this.authorPubkey, muteList.content);
			try {
				privateTags = JSON.parse(json);
			} catch (error) {
				console.error('[mute list parse error]', error);
				throw error;
			}

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

		const encryptedJson = await Signer.encrypt(this.authorPubkey, JSON.stringify(privateTags));
		await this.api.signAndPublish(this.kind, encryptedJson, muteList?.tags ?? []);
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

		let privateTags: string[][];
		try {
			const json = await Signer.decrypt(this.authorPubkey, muteList.content);
			privateTags = JSON.parse(json);
		} catch (error) {
			console.error('[mute list parse error]', error);
			throw error;
		}

		if (
			![...muteList.tags, ...privateTags].some(
				([tagName, w]) => tagName === 'word' && w === word
			)
		) {
			console.log('[already unmute]', word, muteList);
			return;
		}

		const publicTags = muteList.tags.filter(([tagName, w]) => tagName !== 'word' || w !== word);
		privateTags = privateTags.filter(([tagName, w]) => tagName !== 'word' || w !== word);

		const encryptedJson = await Signer.encrypt(this.authorPubkey, JSON.stringify(privateTags));
		await this.api.signAndPublish(this.kind, encryptedJson, publicTags);
	}

	public async update(event: Event) {
		let privateTags: string[][];
		try {
			const json = await Signer.decrypt(this.authorPubkey, event.content);
			privateTags = JSON.parse(json);
		} catch (error) {
			console.error('[mute list parse error]', error);
			throw error;
		}

		// mutePubkeys.set([...filterTags('p', event.tags), ...filterTags('p', privateTags)]);
		// muteEventIds.set([...filterTags('e', event.tags), ...filterTags('e', privateTags)]);
		muteWords.set([...filterTags('word', event.tags), ...filterTags('word', privateTags)]);
		console.log('[mute lists]', get(mutePubkeys), get(muteEventIds), get(muteWords));
	}
}
