import { describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools';
import { createContentWarningContentRevealer } from './reveal-content-warning-content';

const author = 'a'.repeat(64);
const structureId = 'c'.repeat(64);
const payloadId = 'b'.repeat(64);

function structure(overrides: Partial<Event> = {}): Event {
	return {
		id: structureId,
		kind: 1,
		pubkey: author,
		created_at: 1,
		content: '',
		tags: [
			['content-warning', 'reason'],
			['c', payloadId, 'wss://hint.example.com/']
		],
		sig: 'sig',
		...overrides
	};
}

function payload(overrides: Partial<Event> = {}): Event {
	return {
		id: payloadId,
		kind: 36,
		pubkey: author,
		created_at: 1,
		content: 'warned content',
		tags: [['k', '1']],
		sig: 'sig',
		...overrides
	};
}

function setup(fetched: Event | undefined) {
	const fetchEventById = vi.fn(async (): Promise<Event | undefined> => fetched);
	const getSeenOnRelays = vi.fn((): string[] | undefined => [
		'wss://hint.example.com',
		'wss://seen-a.example.com',
		'wss://seen-b.example.com/'
	]);
	const reveal = createContentWarningContentRevealer({
		fetchEventById,
		getSeenOnRelays
	});
	return { reveal, fetchEventById, getSeenOnRelays };
}

describe('createContentWarningContentRevealer', () => {
	it('uses non-empty content as existing NIP-36 without requesting kind 36', async () => {
		const { reveal, fetchEventById } = setup(payload());

		await expect(reveal(structure({ content: 'existing NIP-36' }))).resolves.toBe(
			'existing NIP-36'
		);
		expect(fetchEventById).not.toHaveBeenCalled();
	});

	it('keeps empty content without requesting kind 36 when there is no valid reference', async () => {
		const { reveal, fetchEventById } = setup(payload());

		await expect(reveal(structure({ tags: [['content-warning', 'reason']] }))).resolves.toBe(
			''
		);
		expect(fetchEventById).not.toHaveBeenCalled();
	});

	it('does not fetch the payload until it is revealed', async () => {
		const { reveal, fetchEventById } = setup(payload());
		expect(fetchEventById).not.toHaveBeenCalled();

		await expect(reveal(structure())).resolves.toBe('warned content');
		expect(fetchEventById).toHaveBeenCalledOnce();
	});

	it('fetches the payload only from the normalized union of the relay hint and seen-on relays', async () => {
		const { reveal, fetchEventById, getSeenOnRelays } = setup(payload());

		await reveal(structure());

		expect(getSeenOnRelays).toHaveBeenCalledWith(structureId);
		expect(fetchEventById).toHaveBeenCalledWith(payloadId, [
			'wss://hint.example.com/',
			'wss://seen-a.example.com/',
			'wss://seen-b.example.com/'
		]);
	});

	it('fetches without a relay hint from seen-on relays only', async () => {
		const { reveal, fetchEventById, getSeenOnRelays } = setup(payload());
		getSeenOnRelays.mockReturnValue(['wss://seen.example.com']);

		await reveal(
			structure({
				tags: [
					['content-warning', 'reason'],
					['c', payloadId]
				]
			})
		);

		expect(fetchEventById).toHaveBeenCalledWith(payloadId, ['wss://seen.example.com/']);
	});

	it.each([42, 1111])('resolves a payload for structure kind %i', async (kind) => {
		const { reveal } = setup(payload({ tags: [['k', String(kind)]] }));

		await expect(reveal(structure({ kind }))).resolves.toBe('warned content');
	});

	it('returns only the payload content and keeps the structure event intact', async () => {
		const { reveal } = setup(
			payload({
				tags: [
					['k', '1'],
					['t', 'payload']
				]
			})
		);
		const event = structure();
		const snapshot = structuredClone(event);

		await expect(reveal(event)).resolves.toBe('warned content');
		expect(event).toEqual(snapshot);
	});

	it.each([
		['unavailable', undefined],
		['another kind', payload({ kind: 1 })],
		['another author', payload({ pubkey: 'e'.repeat(64) })],
		['a mismatched k tag', payload({ tags: [['k', '42']] })]
	])('does not reveal content when the payload is %s', async (_, fetched) => {
		const { reveal } = setup(fetched);

		await expect(reveal(structure())).resolves.toBeUndefined();
	});

	it('does not reveal content when fetching fails', async () => {
		const { reveal, fetchEventById } = setup(payload());
		fetchEventById.mockRejectedValue(new Error('relay unavailable'));
		vi.spyOn(console, 'warn').mockImplementation(() => {});

		await expect(reveal(structure())).resolves.toBeUndefined();
	});

	it('reuses a fetched or in-flight payload', async () => {
		const { reveal, fetchEventById } = setup(payload());

		await Promise.all([reveal(structure()), reveal(structure())]);
		await reveal(structure());

		expect(fetchEventById).toHaveBeenCalledOnce();
	});

	it('retries a payload that was unavailable', async () => {
		const { reveal, fetchEventById } = setup(undefined);
		await reveal(structure());

		fetchEventById.mockResolvedValue(payload());

		await expect(reveal(structure())).resolves.toBe('warned content');
		expect(fetchEventById).toHaveBeenCalledTimes(2);
	});
});
