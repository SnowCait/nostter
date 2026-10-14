import { describe, expect, it, vi } from 'vitest';
import { nip19 } from 'nostr-tools';
import { defaultRelays } from '$lib/Constants';

const { fetchEvent } = vi.hoisted(() => ({ fetchEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/Api', () => ({ fetchEvent }));
vi.mock('$lib/server/Restriction', () => ({ checkRestriction: vi.fn() }));
import { load } from './+layout.server';

const id = 'a'.repeat(64);
async function loadPointer(relays: string[]) {
	return load({ params: { slug: nip19.neventEncode({ id, relays }) } } as Parameters<
		typeof load
	>[0]);
}

describe('nevent relay hints', () => {
	it('removes non-public hints before API lookup and client-side use', async () => {
		const result = await loadPointer([
			'wss://127.0.0.1/',
			'wss://[::1]/',
			'wss://relay.example/'
		]);
		expect(result?.relays).toEqual(['wss://relay.example/']);
		expect(fetchEvent).toHaveBeenLastCalledWith(id, ['wss://relay.example/']);
	});
	it('uses application defaults when all pointer hints are non-public', async () => {
		const result = await loadPointer(['wss://relay.local/']);
		expect(result?.relays).toEqual([]);
		expect(fetchEvent).toHaveBeenLastCalledWith(
			id,
			defaultRelays.map(({ url }) => url)
		);
	});
});
