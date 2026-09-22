import { get } from 'svelte/store';
import { createRxOneshotReq, latest } from 'rx-nostr';
import { lastValueFrom } from 'rxjs';
import type * as Nostr from 'nostr-typedef';
import { rxNostr, tie } from './timelines/MainTimeline';
import { filterTags } from './EventHelper';
import { findIdentifier } from './nostr/protocol/event-address';
import { isLegacyEncryption } from './nostr/protocol/nip04';
import { pubkey } from './stores/Author';
import { Signer } from './Signer';
import type { EncryptionCapabilities } from './nostr/signing/signer';

export type ListContentDecrypter = (
	pubkey: string,
	content: string
) => Promise<[tags: string[][], legacy: boolean]>;

export type ListContentEncrypter = (
	pubkey: string,
	tags: string[][],
	legacy?: boolean
) => Promise<string>;

export function createListContentDecrypter({
	nip04,
	nip44
}: EncryptionCapabilities): ListContentDecrypter | undefined {
	if (nip04 === undefined && nip44 === undefined) {
		return undefined;
	}

	return async (pubkey, content) => {
		if (content === '') {
			return [[], false];
		}

		const legacy = isLegacyEncryption(content);
		const encryption = legacy ? nip04 : nip44;
		if (encryption === undefined) {
			return [[], legacy];
		}

		try {
			const json = await encryption.decrypt(pubkey, content);
			return [JSON.parse(json), legacy];
		} catch (error) {
			console.warn('[list parse error]', error);
			return [[], legacy];
		}
	};
}

export function createListContentEncrypter({
	nip04,
	nip44
}: EncryptionCapabilities): ListContentEncrypter {
	return async (pubkey, tags, legacy = false) => {
		if (tags.length === 0) {
			return '';
		}

		const encryption = legacy ? nip04 : nip44;
		if (encryption === undefined) {
			throw new Error(`NIP-${legacy ? '04' : '44'} encryption capability is unavailable`);
		}

		return encryption.encrypt(pubkey, JSON.stringify(tags));
	};
}

export async function fetchListEvent(
	kind: number,
	pubkey: string,
	identifier: string
): Promise<Nostr.Event | undefined> {
	try {
		const req = createRxOneshotReq({
			filters: [{ kinds: [kind], authors: [pubkey], '#d': [identifier] }]
		});
		const { event } = await lastValueFrom(rxNostr.use(req).pipe(tie, latest()));
		return event;
	} catch (error) {
		console.warn('[list event not found]', error);
		return undefined;
	}
}

export function getListTitle(tags: string[][]): string {
	return filterTags('title', tags).at(0) ?? findIdentifier(tags) ?? '-';
}

export async function getListPubkeys(event: Nostr.Event): Promise<string[]> {
	const tags = event.tags;

	const $pubkey = get(pubkey);
	if (event.pubkey === $pubkey) {
		const [privateTags] = await decryptListContent(event.pubkey, event.content);
		tags.push(...privateTags);
	}

	const pubkeys = filterTags('p', tags);
	return [...new Set(pubkeys)];
}

export async function decryptListContent(
	pubkey: string,
	content: string
): Promise<[tags: string[][], legacy: boolean]> {
	if (content === '') {
		return [[], false];
	}
	try {
		const decrypter = createListContentDecrypter(Signer.getEncryptionCapabilities());
		if (decrypter === undefined) {
			return [[], isLegacyEncryption(content)];
		}
		return decrypter(pubkey, content);
	} catch (error) {
		console.warn('[list parse error]', error);
		return [[], isLegacyEncryption(content)];
	}
}

export async function encryptListContent(
	pubkey: string,
	tags: string[][],
	legacy: boolean = false
): Promise<string> {
	if (tags.length === 0) {
		return '';
	}

	const encrypter = createListContentEncrypter(Signer.getEncryptionCapabilities());
	return encrypter(pubkey, tags, legacy);
}
