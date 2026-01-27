import { nip19, type Event } from 'nostr-tools';
import { Signer } from './Signer';
import { now } from 'rx-nostr';
import { Content } from './Content';
import type { User } from '../routes/types';
import { Api } from './Api';
import type { EventItem } from './Items';
import { referTags } from './EventHelper';
import { getRelayHint } from './timelines/MainTimeline';
import { unique } from './Array';

export class NoteComposer {
	async compose(kind: number, content: string, tags: string[][]): Promise<Event | null> {
		try {
			return await Signer.signEvent({
				kind,
				content,
				tags,
				created_at: now()
			});
		} catch {
			return null;
		}
	}

	replyTags(
		content: string,
		replyTo: Event | undefined = undefined,
		channelId: string | undefined = undefined
	): string[][] {
		let pubkeys = new Set<string>();
		const tags: string[][] = [];

		if (channelId) {
			tags.push(['e', channelId, '', 'root']);
			if (replyTo !== undefined) {
				tags.push(['e', replyTo.id, '', 'reply']);
				if (
					replyTo.tags.some(
						([tagName, pubkey]) => tagName === 'p' && pubkey === replyTo.pubkey
					)
				) {
					tags.push(...replyTo.tags.filter(([tagName]) => tagName === 'p'));
				} else {
					tags.push(...replyTo.tags.filter(([tagName]) => tagName === 'p'), [
						'p',
						replyTo.pubkey
					]);
				}
			}
		} else if (replyTo !== undefined) {
			const { root } = referTags(replyTo);
			const relay = getRelayHint(replyTo.id);
			if (root === undefined) {
				tags.push(['e', replyTo.id, relay ?? '', 'root', replyTo.pubkey]);
			} else {
				tags.push(root);
				tags.push(['e', replyTo.id, relay ?? '', 'reply', replyTo.pubkey]);
			}
			pubkeys = new Set([
				replyTo.pubkey,
				...replyTo.tags.filter((x) => x[0] === 'p').map((x) => x[1])
			]);
		}

		const eventIds = Content.findNotesAndNeventsToIds(content);
		tags.push(
			...unique(eventIds).map((id) => {
				const qTag = ['q', id];
				const relay = getRelayHint(id);
				if (relay) {
					qTag.push(relay);
				}
				return qTag;
			})
		);

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
					pubkeys.add((data as nip19.ProfilePointer).pubkey);
				}
			}
		}
		tags.push(...Array.from(pubkeys).map((pubkey) => ['p', pubkey]));

		return tags;
	}

	hashtags(content: string): string[][] {
		const hashtags = Content.findHashtags(content);
		return hashtags.map((hashtag) => ['t', hashtag.toLowerCase()]);
	}

	async emojiTags(content: string, emojiTags: string[][] = []): Promise<string[][]> {
		const tags: string[][] = [];

		// Custom emojis
		tags.push(...emojiTags.filter(([, shortcode]) => content.includes(`:${shortcode}:`)));
		const readApi = new Api();
		const shortcodes = Array.from(
			new Set(
				[...content.matchAll(/:(?<shortcode>\w+):/g)]
					.map((match) => match.groups?.shortcode)
					.filter((x): x is string => x !== undefined)
			)
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
				})
				.filter((x): x is string[] => x !== null)
		);

		return tags;
	}

	contentWarningTags(contentWarningReason: string | undefined = undefined): string[][] {
		const tags: string[][] = [];

		// Content Warning
		if (contentWarningReason !== undefined) {
			tags.push(
				contentWarningReason === ''
					? ['content-warning']
					: ['content-warning', contentWarningReason]
			);
		}

		return tags;
	}
}
