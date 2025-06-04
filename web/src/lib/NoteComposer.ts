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
	async compose(kind: number, content: string, tags: string[][]): Promise<Event> {
		return await Signer.signEvent({
			kind,
			content,
			tags,
			created_at: now()
		});
	}

	replyTags(
		content: string,
		$replyTo: EventItem | undefined = undefined,
		$channelIdStore: string | undefined = undefined,
		pubkeys: Set<string> = new Set()
	): string[][] {
		const tags: string[][] = [];

		if ($channelIdStore) {
			tags.push(['e', $channelIdStore, '', 'root']);
			if ($replyTo !== undefined) {
				tags.push(['e', $replyTo.event.id, '', 'reply']);
				if (
					$replyTo.event.tags.some(
						([tagName, pubkey]) => tagName === 'p' && pubkey === $replyTo.event.pubkey
					)
				) {
					tags.push(...$replyTo.event.tags.filter(([tagName]) => tagName === 'p'));
				} else {
					tags.push(...$replyTo.event.tags.filter(([tagName]) => tagName === 'p'), [
						'p',
						$replyTo.event.pubkey
					]);
				}
			}
		} else if ($replyTo !== undefined) {
			const { root } = referTags($replyTo.event);
			const relay = getRelayHint($replyTo.event.id);
			if (root === undefined) {
				tags.push(['e', $replyTo.event.id, relay ?? '', 'root', $replyTo.event.pubkey]);
			} else {
				tags.push(root);
				tags.push(['e', $replyTo.event.id, relay ?? '', 'reply', $replyTo.event.pubkey]);
			}
			pubkeys = new Set([
				$replyTo.event.pubkey,
				...$replyTo.event.tags.filter((x) => x[0] === 'p').map((x) => x[1])
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
		tags.push(...emojiTags);
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
