export class Token {
	constructor(
		readonly name: 'text' | 'ref' | 'hashtag' | 'url',
		readonly text: string,
		readonly index?: number
	) {}
}

export class Content {
	constructor(readonly content: string) {}

	parse(): Token[] {
		const matches = [
			...this.content.matchAll(/#\S+/g),
			...this.content.matchAll(/https?:\/\/\S+/g)
		].sort((x, y) => {
			if (x.index === undefined || y.index === undefined) {
				throw new Error('Index is undefined');
			}

			return x.index - y.index;
		});
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
				tokens.push(new Token('text', this.content.slice(index, matchIndex)));
			}

			if (text.startsWith('#')) {
				const match = text.match(/#\[(?<i>\d+)]/);
				if (match !== null) {
					const i = Number(match.groups?.i);
					tokens.push(new Token('ref', text, i));
				} else {
					tokens.push(new Token('hashtag', text));
				}
			} else {
				tokens.push(new Token('url', text));
			}

			index = matchIndex + text.length;
		}

		if (index < this.content.length) {
			tokens.push(new Token('text', this.content.slice(index, this.content.length)));
		}

		return tokens;
	}
}
