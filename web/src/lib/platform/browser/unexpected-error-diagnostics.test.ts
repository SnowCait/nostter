import { describe, expect, it, vi } from 'vitest';
import {
	createUnexpectedErrorReporter,
	redactPathname,
	toSourceLocation,
	toSourcePath
} from './unexpected-error-diagnostics';

const base = 'https://nostter.app/npub1abcdefgh?tab=likes#top';

describe('redactPathname', () => {
	it.each([
		['/', '/'],
		['/home', '/home'],
		['/settings/1', '/settings/1'],
		['/npub1abcdefgh', '/[npub]'],
		['/nostr%3Anevent1abcdefgh', '/[nevent]'],
		['/npub1abcdefgh/lists/Bookmarks', '/[npub]/lists/[param]'],
		['/search/nostr%20tips', '/search/[param]']
	])('redacts %s to %s', (pathname, expected) => {
		expect(redactPathname(pathname)).toBe(expected);
	});
});

describe('toSourcePath', () => {
	it('keeps an immutable asset path without its query or hash', () => {
		expect(
			toSourcePath('https://nostter.app/_app/immutable/chunks/Cx9a-b_1.js?v=1#x', base)
		).toBe('/_app/immutable/chunks/Cx9a-b_1.js');
	});

	it('redacts a page path reported by an inline script', () => {
		expect(toSourcePath(base, base)).toBe('/[npub]');
	});

	it.each([
		['an empty filename', ''],
		['a cross-origin URL', 'https://example.com/_app/immutable/chunks/a.js'],
		['an extension URL', 'chrome-extension://abcdefgh/content.js'],
		['a too long path', `https://nostter.app/_app/immutable/${'a'.repeat(241)}.js`]
	])('omits %s', (_, filename) => {
		expect(toSourcePath(filename, base)).toBeUndefined();
	});
});

describe('toSourceLocation', () => {
	it('takes only the sanitized source location from an error event', () => {
		const event = {
			error: new TypeError('secret message'),
			message: 'Uncaught TypeError: secret message',
			filename: 'https://nostter.app/_app/immutable/entry/app.js?v=1',
			lineno: 3,
			colno: 14
		};

		expect(toSourceLocation(event, base)).toStrictEqual({
			filename: '/_app/immutable/entry/app.js',
			line: 3,
			column: 14
		});
	});

	it('omits an unknown source location', () => {
		expect(toSourceLocation({ filename: '', lineno: 0, colno: 0 }, base)).toStrictEqual({
			filename: undefined,
			line: undefined,
			column: undefined
		});
	});
});

describe('createUnexpectedErrorReporter', () => {
	it('sends each type at most once', () => {
		const send = vi.fn();
		const report = createUnexpectedErrorReporter(send);

		report('window-error', () => ({ line: 1 }));
		report('window-error', () => ({ line: 2 }));
		report('unhandled-rejection');
		report('sveltekit-handle-error');
		report('unhandled-rejection');
		report('sveltekit-handle-error');

		expect(send.mock.calls).toEqual([
			['window-error', { line: 1 }],
			['unhandled-rejection', undefined],
			['sveltekit-handle-error', undefined]
		]);
	});

	it('does not throw or retry when reporting fails', () => {
		const send = vi.fn(() => {
			throw new Error('send failed');
		});
		const report = createUnexpectedErrorReporter(send);

		expect(() => report('unhandled-rejection')).not.toThrow();
		expect(() =>
			report('window-error', () => {
				throw new Error('locate failed');
			})
		).not.toThrow();
		report('unhandled-rejection');
		report('window-error');

		expect(send).toHaveBeenCalledTimes(1);
	});
});
