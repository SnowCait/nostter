import { describe, expect, it } from 'vitest';
import type { Event } from 'nostr-tools';
import {
	getContentWarningPayloadReference,
	getContentWarningContentSource,
	isValidContentWarningPayload
} from './content-warning-payload';

const author = 'a'.repeat(64);
const payloadId = 'b'.repeat(64);

function structure(overrides: Partial<Event> = {}): Event {
	return {
		id: 'c'.repeat(64),
		kind: 1,
		pubkey: author,
		created_at: 1,
		content: '',
		tags: [
			['content-warning', 'reason'],
			['c', payloadId]
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

describe('getContentWarningPayloadReference', () => {
	it.each([1, 42, 1111])('parses a payload reference of kind %i with empty content', (kind) => {
		expect(getContentWarningPayloadReference(structure({ kind }))).toEqual({
			id: payloadId,
			relay: undefined
		});
	});

	it('does not treat a c tag as a payload reference when content is not empty', () => {
		expect(
			getContentWarningPayloadReference(structure({ content: 'existing NIP-36' }))
		).toBeUndefined();
	});

	it('parses a wss relay hint', () => {
		const event = structure({
			tags: [
				['content-warning', 'reason'],
				['c', payloadId, 'wss://relay.example.com']
			]
		});

		expect(getContentWarningPayloadReference(event)).toEqual({
			id: payloadId,
			relay: 'wss://relay.example.com'
		});
	});

	it.each(['ws://relay.example.com', 'https://relay.example.com', 'invalid'])(
		'ignores a non-wss relay hint %s',
		(relay) => {
			const event = structure({
				tags: [
					['content-warning', 'reason'],
					['c', payloadId, relay]
				]
			});

			expect(getContentWarningPayloadReference(event)).toEqual({
				id: payloadId,
				relay: undefined
			});
		}
	);

	it.each([undefined, '', 'B'.repeat(64), 'b'.repeat(63), 'note1xyz'])(
		'rejects an invalid event ID %s',
		(id) => {
			const event = structure({
				tags: [['content-warning', 'reason'], id === undefined ? ['c'] : ['c', id]]
			});

			expect(getContentWarningPayloadReference(event)).toBeUndefined();
		}
	);

	it('rejects ambiguous references from multiple c tags', () => {
		const event = structure({
			tags: [
				['content-warning', 'reason'],
				['c', payloadId],
				['c', 'd'.repeat(64)]
			]
		});

		expect(getContentWarningPayloadReference(event)).toBeUndefined();
	});

	it('requires a content-warning tag', () => {
		expect(getContentWarningPayloadReference(structure({ tags: [['c', payloadId]] }))).toBe(
			undefined
		);
	});

	it.each([6, 30023])('does not support structure kind %i', (kind) => {
		expect(getContentWarningPayloadReference(structure({ kind }))).toBeUndefined();
	});
});

describe('getContentWarningContentSource', () => {
	it('uses non-empty content as existing NIP-36 even with a c tag', () => {
		expect(getContentWarningContentSource(structure({ content: 'existing NIP-36' }))).toEqual({
			type: 'inline',
			content: 'existing NIP-36'
		});
	});

	it('keeps empty content when there is no valid payload reference', () => {
		expect(
			getContentWarningContentSource(structure({ tags: [['content-warning', 'reason']] }))
		).toEqual({ type: 'inline', content: '' });
	});

	it('uses the payload when content is empty and the reference is valid', () => {
		expect(getContentWarningContentSource(structure())).toEqual({
			type: 'payload',
			reference: { id: payloadId, relay: undefined }
		});
	});
});

describe('isValidContentWarningPayload', () => {
	const reference = { id: payloadId, relay: undefined };

	it('accepts a valid payload', () => {
		expect(isValidContentWarningPayload(structure(), reference, payload())).toBe(true);
	});

	it.each([42, 1111])('accepts a k tag matching structure kind %i', (kind) => {
		expect(
			isValidContentWarningPayload(
				structure({ kind }),
				reference,
				payload({ tags: [['k', String(kind)]] })
			)
		).toBe(true);
	});

	it('rejects a payload whose ID differs from the reference', () => {
		expect(
			isValidContentWarningPayload(structure(), reference, payload({ id: 'd'.repeat(64) }))
		).toBe(false);
	});

	it('rejects a non-36 kind', () => {
		expect(isValidContentWarningPayload(structure(), reference, payload({ kind: 1 }))).toBe(
			false
		);
	});

	it('rejects a pubkey mismatch', () => {
		expect(
			isValidContentWarningPayload(
				structure(),
				reference,
				payload({ pubkey: 'e'.repeat(64) })
			)
		).toBe(false);
	});

	it('rejects a payload without a k tag', () => {
		expect(isValidContentWarningPayload(structure(), reference, payload({ tags: [] }))).toBe(
			false
		);
	});

	it('rejects a payload with multiple k tags', () => {
		expect(
			isValidContentWarningPayload(
				structure(),
				reference,
				payload({
					tags: [
						['k', '1'],
						['k', '1']
					]
				})
			)
		).toBe(false);
	});

	it('rejects a k tag that does not match the structure kind', () => {
		expect(
			isValidContentWarningPayload(structure(), reference, payload({ tags: [['k', '42']] }))
		).toBe(false);
	});
});
