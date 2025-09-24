import { nip19 } from 'nostr-tools';
import { unique } from './Array';
import escapeStringRegexp from 'escape-string-regexp';
import twitter from 'twitter-text';

export class Token {
	constructor(
		readonly name: 'text' | 'reference' | 'hashtag' | 'emoji' | 'url' | 'relay' | 'nip',
		readonly text: string,
		readonly index: number,
		readonly url?: string
	) {}
}

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

		const emojis = new Map(
			tags
				.filter(
					([tagName, shortcode, url]) =>
						tagName === 'emoji' &&
						shortcode &&
						url &&
						url.startsWith('https://') &&
						URL.canParse(url)
				)
				.map(([, shortcode, url]) => [shortcode, url])
		);

		const foundTokens: Token[] = [];
		foundTokens.push(
			...urls
				.map(({ url, indices }) => new Token('url', url, indices[0]))
				.filter((token) => token.index === 0 || content[token.index - 1] !== '"') // Ignore URLs in JSON
		);
		if (hashtags.length > 0) {
			foundTokens.push(
				...[
					...content.matchAll(
						new RegExp(`#(${hashtags.map(escapeStringRegexp).join('|')})`, 'gi')
					)
				].map((match) => new Token('hashtag', match[0], match.index))
			);
		}
		if (emojis.size > 0) {
			foundTokens.push(
				...[
					...content.matchAll(
						new RegExp(
							`:(${[...emojis.keys()].filter((x) => /^\w+$/.test(x)).join('|')}):`,
							'g'
						)
					)
				].map((match) => new Token('emoji', match[0], match.index, emojis.get(match[1])))
			);
		}
		foundTokens.push(
			...[
				...content.matchAll(
					/\bnostr:((note|npub|naddr|nevent|nprofile)1\w{6,})\b|#\[\d+\]/g
				)
			].map((match) => new Token('reference', match[0], match.index))
		);
		foundTokens.push(
			...[...content.matchAll(/(?<=^|\s)(wss|ws):\/\/\S+/g)].map(
				(match) => new Token('relay', match[0], match.index)
			)
		);
		foundTokens.push(
			...[...content.matchAll(/NIP-[0-9]{2,}/g)].map(
				(match) => new Token('nip', match[0], match.index)
			)
		);

		const tokens: Token[] = [];
		let index = 0;
		for (const token of foundTokens.sort((x, y) => x.index - y.index)) {
			if (token.index === undefined || token.index < index) {
				continue;
			}

			if (token.index > index) {
				tokens.push(new Token('text', content.slice(index, token.index), index));
			}

			tokens.push(token);

			index = token.index + token.text.length;
		}

		if (index < content.length) {
			tokens.push(new Token('text', content.slice(index, content.length), index));
		}

		return tokens;
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
