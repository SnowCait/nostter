import type { Event } from 'nostr-tools';
import { describe, expect, it, vi } from 'vitest';
import { parseChannelMetadata } from './nip28';

function eventWithContent(content: string): Event {
	return { content } as Event;
}

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
