import { nip19 } from 'nostr-tools';
import { unique } from './Array';
import escapeStringRegexp from 'escape-string-regexp';
import twitter from 'twitter-text';
import { addressRegexp, shortcodeRegexp } from './Constants';
import { Emojisets } from 'nostr-tools/kinds';

type TextToken = {
	type: 'text';
	text: string;
	start: number;
};

type ReferenceToken = {
	type: 'reference';
	text: string;
	start: number;
	tagIndex?: number; // for legacy reference #[index]
};

type HashtagToken = {
	type: 'hashtag';
	text: string;
	start: number;
};

type EmojiToken = {
	type: 'emoji';
	text: string;
	start: number;
	url?: string;
	address?: string; // kind 30030 address
};

type UrlToken = {
	type: 'url';
	text: string;
	start: number;
};

type RelayToken = {
	type: 'relay';
	text: string;
	start: number;
};

type NipToken = {
	type: 'nip';
	text: string;
	start: number;
};

export type Token =
	| TextToken
	| ReferenceToken
	| HashtagToken
	| EmojiToken
	| UrlToken
	| RelayToken
	| NipToken;

export class Content {
	static parse(content: string, tags: string[][] = []): Token[] {
		if (content.length === 0) {
			return [];
		}

		const urls = twitter.extractUrlsWithIndices(content, { extractUrlsWithoutProtocol: false });

		const hashtags = unique(
			tags
				.filter(([tagName, tagContent]) => tagName === 't' && tagContent)
				.map(([, tagContent]) => tagContent.toLowerCase())
		);
		hashtags.sort((x, y) => y.length - x.length);

		const emojis = indexEmojisByShortcode(content, tags);

		const foundTokens: Token[] = [];
		foundTokens.push(
			...urls
				.map(
					({ url, indices }): UrlToken => ({ type: 'url', text: url, start: indices[0] })
				)
				.filter((token) => token.start === 0 || content[token.start - 1] !== '"') // ignore URLs in JSON
		);
		if (hashtags.length > 0) {
			foundTokens.push(
				...[
					...content.matchAll(
						new RegExp(`#(${hashtags.map(escapeStringRegexp).join('|')})`, 'gi')
					)
				].map(
					(match): HashtagToken => ({
						type: 'hashtag',
						text: match[0],
						start: match.index
					})
				)
			);
		}
		if (emojis.size > 0) {
			foundTokens.push(
				...[
					...content.matchAll(new RegExp(`:(${[...emojis.keys()].join('|')}):`, 'g'))
				].map((match): EmojiToken => {
					const tag = emojis.get(match[1]);
					const address = tag?.[3];
					return {
						type: 'emoji',
						text: match[0],
						start: match.index,
						url: tag?.[2],
						address:
							typeof address === 'string' &&
							address.startsWith(`${Emojisets}:`) &&
							addressRegexp.test(address)
								? address
								: undefined
					};
				})
			);
		}
		foundTokens.push(
			...[
				...content.matchAll(
					/\bnostr:((note|npub|naddr|nevent|nprofile)1\w{6,})\b|#\[(?<i>\d+)\]/g
				)
			].map(
				(match): ReferenceToken => ({
					type: 'reference',
					text: match[0],
					start: match.index,
					tagIndex: match.groups?.i ? Number(match.groups.i) : undefined
				})
			)
		);
		foundTokens.push(
			...[...content.matchAll(/(?<=^|\s)(wss|ws):\/\/\S+/g)].map(
				(match): RelayToken => ({
					type: 'relay',
					text: match[0],
					start: match.index
				})
			)
		);
		foundTokens.push(
			...[...content.matchAll(/NIP-[0-9A-Z]{2,}/g)].map(
				(match): NipToken => ({
					type: 'nip',
					text: match[0],
					start: match.index
				})
			)
		);

		return composeTokens(content, foundTokens);
	}

	static findNpubsAndNprofiles(content: string): string[] {
		const matches = content.matchAll(/(?<=^|\s)(nostr:)?(?<npub>(npub|nprofile)1\w{6,})\b/g);
		return [...matches]
			.map((match) => match.groups?.npub)
			.filter((x): x is string => x !== undefined);
	}

	static findNpubsAndNprofilesToPubkeys(content: string): string[] {
		return this.findNpubsAndNprofiles(content)
			.map((x) => {
				try {
					const { type, data } = nip19.decode(x);
					switch (type) {
						case 'npub':
							return data as string;
						case 'nprofile':
							return (data as nip19.ProfilePointer).pubkey;
						default:
							return undefined;
					}
				} catch (error) {
					console.warn('[nip19 decode error]', x, error);
					return undefined;
				}
			})
			.filter((x): x is string => x !== undefined);
	}

	static findNotesAndNevents(content: string): string[] {
		const matches = content.matchAll(/(?<=^|\s)(nostr:)?(?<note>(note|nevent)1\w{6,})\b/g);
		return [...matches]
			.map((match) => match.groups?.note)
			.filter((x): x is string => x !== undefined);
	}

	static findNotesAndNeventsToIds(content: string): string[] {
		return this.findNotesAndNevents(content)
			.map((x) => {
				try {
					const { type, data } = nip19.decode(x);
					switch (type) {
						case 'note':
							return data as string;
						case 'nevent':
							return (data as nip19.EventPointer).id;
						default:
							return undefined;
					}
				} catch {
					return undefined;
				}
			})
			.filter((x): x is string => x !== undefined);
	}

	static findHashtags(content: string): string[] {
		const matches = content.matchAll(/(?<=^|\s)#(?<hashtag>[\p{Letter}\p{Number}_]+)/gu);
		const hashtags = [...matches]
			.map((match) => match.groups?.hashtag)
			.filter((x): x is string => x !== undefined);
		return unique(hashtags);
	}

	static replaceNip19(content: string): string {
		return content.replaceAll(
			/(?<=^|\s)(nostr:)?(?<bech32>(note|naddr|nevent)1\w{6,})\b/g,
			'nostr:$<bech32>'
		);
	}
}

function composeTokens(content: string, foundTokens: Token[]): Token[] {
	const tokens: Token[] = [];
	let index = 0;
	for (const token of foundTokens.sort((x, y) => x.start - y.start)) {
		if (token.start === undefined || token.start < index) {
			continue;
		}

		if (token.start > index) {
			tokens.push({ type: 'text', text: content.slice(index, token.start), start: index });
		}

		tokens.push(token);

		index = token.start + token.text.length;
	}

	if (index < content.length) {
		tokens.push({ type: 'text', text: content.slice(index, content.length), start: index });
	}
	return tokens;
}

function indexEmojisByShortcode(content: string, tags: string[][]) {
	return new Map<string, string[]>(
		tags
			.filter(
				([tagName, shortcode, url]) =>
					tagName === 'emoji' &&
					shortcode &&
					shortcodeRegexp.test(shortcode) &&
					url &&
					url.startsWith('https://') &&
					URL.canParse(url) &&
					content.includes(`:${shortcode}:`)
			)
			.map((tag) => [tag[1], tag])
	);
}

export function emojify(content: string, tags: string[][]): Token[] {
	const emojis = indexEmojisByShortcode(content, tags);

	const foundTokens: Token[] = [];

	if (emojis.size > 0) {
		foundTokens.push(
			...[...content.matchAll(new RegExp(`:(${[...emojis.keys()].join('|')}):`, 'g'))].map(
				(match): EmojiToken => {
					const tag = emojis.get(match[1]);
					const address = tag?.[3];
					console.log(
						address,
						address?.startsWith(`${Emojisets}:`),
						addressRegexp.test(address!)
					);
					return {
						type: 'emoji',
						text: match[0],
						start: match.index,
						url: tag?.[2],
						address:
							typeof address === 'string' &&
							address.startsWith(`${Emojisets}:`) &&
							addressRegexp.test(address)
								? address
								: undefined
					};
				}
			)
		);
	}

	return composeTokens(content, foundTokens);
}
