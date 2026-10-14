import { describe, expect, it } from 'vitest';
import { nip19 } from 'nostr-tools';
import { load } from './+page';

describe('naddr relay hints', () => {
	it('removes non-public hints before they can be added to client relays', async () => {
		const slug = nip19.naddrEncode({
			kind: 30023,
			pubkey: 'a'.repeat(64),
			identifier: 'article',
			relays: ['wss://127.1/', 'wss://[fd00::1]/', 'wss://relay.example/']
		});
		const result = await load({ params: { slug } } as Parameters<typeof load>[0]);
		expect(result?.relays).toEqual(['wss://relay.example/']);
	});
});
