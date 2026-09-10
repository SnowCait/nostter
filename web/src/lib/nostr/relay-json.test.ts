import { expect, it } from 'vitest';
import { parseRelayJson } from '../EventHelper';

it('normalizes legacy relay keys, filters unusable URLs, and preserves permissions', () => {
	const relays = parseRelayJson(
		JSON.stringify({
			'wss://READ.EXAMPLE:443': { read: true, write: false },
			'wss://write.example': { read: false, write: true },
			'ws://nos.lol': { read: true, write: true }
		})
	);
	expect([...relays]).toEqual([
		['wss://read.example/', { read: true, write: false }],
		['wss://write.example/', { read: false, write: true }]
	]);
});

it('ignores malformed legacy JSON', () => {
	expect(parseRelayJson('{')).toEqual(new Map());
});
