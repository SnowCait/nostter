import { nip19, type Event } from 'nostr-tools';
import { Signer } from './Signer';
import { now } from 'rx-nostr';
import { Content } from './Content';
import type { ProfilePointer } from 'nostr-tools/lib/nip19';
import type { User } from '../routes/types';
import { Api } from './Api';
import { pool } from '../stores/Pool';
import { get } from 'svelte/store';
import { readRelays } from '../stores/Author';

export class NoteComposer {
	async compose(
		kind: number,
		content: string,
		tags: string[][],
		$replyTo: Event | undefined = undefined,
		emojiTags: string[][] = [],
		$channelIdStore: string | undefined = undefined,
		pubkeys: Set<string> = new Set(),
		selectedCustomEmojis: Map<string, string> = new Map(),
		contentWarningReason: string | undefined = undefined
	): Promise<Event> {
		if ($channelIdStore) {
			tags.push(['e', $channelIdStore, '', 'root']);
			if ($replyTo !== undefined) {
				tags.push(['e', $replyTo.id, '', 'reply']);
				if (
					$replyTo.tags.some(
						([tagName, pubkey]) => tagName === 'p' && pubkey === $replyTo?.pubkey
					)
				) {
					tags.push(...$replyTo.tags.filter(([tagName]) => tagName === 'p'));
				} else {
					tags.push(...$replyTo.tags.filter(([tagName]) => tagName === 'p'), [
						'p',
						$replyTo.pubkey
					]);
				}
			}
		} else if ($replyTo !== undefined) {
			if ($replyTo.tags.filter((x) => x[0] === 'e').length === 0) {
				// root
				tags.push(['e', $replyTo.id, '', 'root']);
			} else {
				// reply
				tags.push(['e', $replyTo.id, '', 'reply']);
				const root = $replyTo.tags.find(
					([tagName, , , marker]) => tagName === 'e' && marker === 'root'
				);
				if (root !== undefined) {
					tags.push(['e', root[1], '', 'root']);
				}
			}
			pubkeys = new Set([
				$replyTo.pubkey,
				...$replyTo.tags.filter((x) => x[0] === 'p').map((x) => x[1])
			]);
		}

		const eventIds = Content.findNotesAndNeventsToIds(content);
		tags.push(...Array.from(new Set(eventIds)).map((eventId) => ['e', eventId, '', 'mention']));

		for (const { type, data } of Content.findNpubsAndNprofiles(content).map((x) => {
			try {
				return nip19.decode(x);
			} catch {
				return { type: undefined, data: undefined };
			}
		})) {
			switch (type) {
				case 'npub': {
					pubkeys.add(data as string);
					break;
				}
				case 'nprofile': {
					pubkeys.add((data as ProfilePointer).pubkey);
				}
			}
		}
		tags.push(...Array.from(pubkeys).map((pubkey) => ['p', pubkey]));

		const hashtags = Content.findHashtags(content);
		tags.push(...Array.from(hashtags).map((hashtag) => ['t', hashtag]));

		// Custom emojis
		tags.push(...emojiTags);
		const readApi = new Api(get(pool), get(readRelays));
		const shortcodes = Array.from(
			new Set(
				[...content.matchAll(/:(?<shortcode>\w+):/g)]
					.map((match) => match.groups?.shortcode)
					.filter((x): x is string => x !== undefined)
			)
		);
		new Map(
			['npub']
				.filter((x) => x.startsWith('npub'))
				.map((x) => {
					try {
						// throw new Error();
						return [x, (x + 1) as string];
					} catch (e) {
						return [x, ''];
					}
				})
		);
		const customEmojiPubkeysMap = new Map(
			shortcodes
				.filter((shortcode) => shortcode.startsWith('npub1'))
				.map((npub) => {
					try {
						const { data: pubkey } = nip19.decode(npub);
						return [npub, pubkey as string];
					} catch (error) {
						console.warn('[invalid npub]', npub, error);
						return [npub, undefined];
					}
				})
		);
		const customEmojiMetadataEventsMap = await readApi.fetchMetadataEventsMap(
			[...customEmojiPubkeysMap]
				.map(([, pubkey]) => pubkey)
				.filter((pubkey): pubkey is string => pubkey !== undefined)
		);
		tags.push(
			...shortcodes
				.filter(([, shortcode]) => !emojiTags.some(([, s]) => s === shortcode))
				.map((shortcode) => {
					const imageUrl = selectedCustomEmojis.get(shortcode);
					if (imageUrl === undefined) {
						const pubkey = customEmojiPubkeysMap.get(shortcode);
						if (pubkey === undefined) {
							return null;
						}
						const metadataEvent = customEmojiMetadataEventsMap.get(pubkey);
						if (metadataEvent === undefined) {
							return null;
						}
						try {
							const metadata = JSON.parse(metadataEvent.content) as User;
							const picture = new URL(metadata.picture);
							return ['emoji', shortcode, picture.href];
						} catch (error) {
							console.warn('[invalid metadata]', metadataEvent, error);
							return null;
						}
					}
					return ['emoji', shortcode, imageUrl];
				})
				.filter((x): x is string[] => x !== null)
		);

		// Content Warning
		if (contentWarningReason !== undefined) {
			tags.push(
				contentWarningReason === ''
					? ['content-warning']
					: ['content-warning', contentWarningReason]
			);
		}

		return await Signer.signEvent({
			kind,
			content,
			tags,
			created_at: now()
		});
	}
}
