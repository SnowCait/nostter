import type { Event } from '../routes/types';

export class Author {
	constructor(private pubkey: string) {}

	isRelated(event: Event): boolean {
		return (
			event.pubkey !== this.pubkey &&
			event.tags.some(
				([tagName, tagContent]) => tagName === 'p' && tagContent === this.pubkey
			)
		);
	}
}
