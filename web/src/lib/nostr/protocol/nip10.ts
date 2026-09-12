import type { Event } from 'nostr-tools';

export function extractThreadReferenceTags(event: Event): {
	root: string[] | undefined;
	reply: string[] | undefined;
} {
	let root = event.tags.findLast(([tagName, , , marker]) => tagName === 'e' && marker === 'root');
	let reply = event.tags.findLast(
		([tagName, , , marker]) => tagName === 'e' && marker === 'reply'
	);

	// Deprecated NIP-10
	if (root === undefined || reply === undefined) {
		const eTags = event.tags.filter(
			([tagName, , , marker]) => tagName === 'e' && marker !== 'mention'
		);
		if (eTags.length === 1) {
			root = root ?? eTags[0];
			reply = undefined;
		} else if (eTags.length > 1) {
			root = root ?? eTags.filter(([, id]) => id !== reply?.at(1)).at(0);
			reply = reply ?? eTags.filter(([, id]) => id !== root?.at(1)).at(-1);
		}
	}

	return { root, reply };
}
