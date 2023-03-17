export class Token {
	constructor(
		readonly name: 'text' | 'reference' | 'hashtag' | 'url',
		readonly text: string,
		readonly index?: number
	) {}
}

export class Content {
	static parse(content: string): Token[] {
		const matches = [...content.matchAll(/#\S+/g), ...content.matchAll(/https?:\/\/\S+/g)].sort(
			(x, y) => {
				if (x.index === undefined || y.index === undefined) {
					throw new Error('Index is undefined');
				}

				return x.index - y.index;
			}
		);
		console.debug([...matches]);

		let tokens: Token[] = [];
		let index = 0;
		for (const match of matches) {
			const text = match[0];
			const matchIndex = match.index;

			// URL.hash is not #hashtag
			// URL mathes earlier than URL.hash and skip URL.hash
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
}
