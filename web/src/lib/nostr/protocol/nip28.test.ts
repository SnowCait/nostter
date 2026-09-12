import type { Event } from 'nostr-tools';
import { describe, expect, it, vi } from 'vitest';
import { findChannelId, parseChannelMetadata } from './nip28';

function eventWithContent(content: string): Event {
	return { content } as Event;
}

const channelId = 'a'.repeat(64);
const otherChannelId = 'b'.repeat(64);

describe('findChannelId', () => {
	it('returns a valid marked root e tag', () => {
		expect(findChannelId([['e', channelId, '', 'root']])).toBe(channelId);
	});

	it('returns a valid unmarked e tag', () => {
		expect(findChannelId([['e', channelId]])).toBe(channelId);
	});

	it('ignores an unmarked p tag', () => {
		expect(findChannelId([['p', channelId]])).toBeUndefined();
	});

	it('ignores an e tag with an invalid event ID', () => {
		expect(findChannelId([['e', 'invalid']])).toBeUndefined();
	});

	it('returns a valid candidate after an invalid candidate', () => {
		expect(
			findChannelId([
				['e', 'invalid'],
				['e', channelId]
			])
		).toBe(channelId);
	});

	it('ignores an e tag with a reply marker', () => {
		expect(
			findChannelId([
				['e', otherChannelId, '', 'reply'],
				['e', channelId]
			])
		).toBe(channelId);
	});

	it('returns undefined when there is no candidate', () => {
		expect(findChannelId([])).toBeUndefined();
	});
});

describe('parseChannelMetadata', () => {
	it('parses partial channel metadata', () => {
		expect(parseChannelMetadata(eventWithContent('{"name":"nostter"}'))).toEqual({
			name: 'nostter'
		});
	});

	it('logs parse failures and returns undefined', () => {
		const event = eventWithContent('{');
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

		expect(parseChannelMetadata(event)).toBeUndefined();
		expect(consoleError).toHaveBeenCalledWith(
			'[channel metadata parse error]',
			expect.any(SyntaxError),
			event
		);

		consoleError.mockRestore();
	});
});
