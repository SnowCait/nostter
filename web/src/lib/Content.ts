export class Token {
	constructor(
		readonly name: 'text' | 'reference' | 'hashtag' | 'url' | 'nip',
		readonly text: string,
		readonly index?: number
	) {}
}

export class Content {
	static parse(content: string, tags: string[][] = []): Token[] {
		const hashtags = tags
			.filter(([tagName, tagContent]) => tagName === 't' && tagContent !== undefined)
			.map(([, tagContent]) => tagContent);
		const matches = [
			...(hashtags.length > 0
				? content.matchAll(new RegExp(`(${hashtags.map((x) => `#${x}`).join('|')})`, 'g'))
				: []),
			...content.matchAll(/\bnostr:((note|npub|naddr|nevent|nprofile)1\w+)\b|#\[\d+\]/g),
			...content.matchAll(/https?:\/\/\S+/g),
			...content.matchAll(/NIP-[0-9]+/g)
		].sort((x, y) => {
			if (x.index === undefined || y.index === undefined) {
				throw new Error('Index is undefined');
			}

			return x.index - y.index;
		});

		const tokens: Token[] = [];
		let index = 0;
		for (const match of matches) {
			const text = match[0];
			const matchIndex = match.index;

			if (matchIndex === undefined || matchIndex < index) {
				continue;
			}

			if (matchIndex > index) {
				tokens.push(new Token('text', content.slice(index, matchIndex)));
			}

			if (text.startsWith('#')) {
				const m = text.match(/#\[(?<i>\d+)]/);
				if (m !== null) {
					const i = Number(m.groups?.i);
					tokens.push(new Token('reference', text, i));
				} else {
					tokens.push(new Token('hashtag', text));
				}
			} else if (text.startsWith('nostr:')) {
				tokens.push(new Token('reference', text));
			} else if (text.startsWith('NIP-')) {
				tokens.push(new Token('nip', text));
			} else {
				tokens.push(new Token('url', text));
			}

			index = matchIndex + text.length;
		}

		if (index < content.length) {
			tokens.push(new Token('text', content.slice(index, content.length)));
		}

		return tokens;
	}

	static findNpubs(content: string): string[] {
		const matches = content.matchAll(/\b(nostr:)?(?<npub>npub1\w+)\b/g);
		return [...matches]
			.map((match) => match.groups?.npub)
			.filter((x): x is string => x !== undefined);
	}
}
