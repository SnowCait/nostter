import type { Filter } from 'nostr-tools';
import { chunk } from './Array';
import { filterLimitItems, followeesKinds } from './Constants';

export class Timeline {
	public static createChunkedFilters(authors: string[], since: number, until: number): Filter[] {
		return chunk(authors, filterLimitItems).map((chunkedAuthors) => {
			return {
				kinds: followeesKinds,
				authors: chunkedAuthors,
				until,
				since
			};
		});
	}
}
