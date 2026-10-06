import { describe, expect, it, vi } from 'vitest';
import {
	createUnexpectedErrorReporter,
	describeError,
	describeErrorEvent,
	redactPathname,
	serializeDiagnostic,
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

describe('describeError', () => {
	it('describes an Error with bounded fields', () => {
		const error = new TypeError('m'.repeat(1025));
		error.stack = 's'.repeat(4097);

		expect(describeError(error)).toEqual({
			name: 'TypeError',
			message: 'm'.repeat(1024),
			stack: 's'.repeat(4096)
		});
	});

	it('describes a primitive by its bounded string representation', () => {
		expect(describeError('x'.repeat(1025))).toEqual({ message: 'x'.repeat(1024) });
		expect(describeError(42)).toEqual({ message: '42' });
		expect(describeError(undefined)).toEqual({ message: 'undefined' });
		expect(describeError(null)).toEqual({ message: 'null' });
	});

	it('does not serialize non-Error values', () => {
		expect(describeError({ pubkey: 'secret', content: 'post' })).toEqual({
			message: '[object]'
		});
		expect(describeError(['secret'])).toEqual({ message: '[object]' });
		expect(describeError(Symbol('secret'))).toEqual({ message: '[symbol]' });
		expect(describeError(() => 'secret')).toEqual({ message: '[function]' });
	});
});

describe('describeErrorEvent', () => {
	it('describes the error object and its source location', () => {
		const error = new Error('failed');

		expect(
			describeErrorEvent(
				{
					error,
					message: 'Uncaught Error: failed',
					filename: 'https://nostter.app/_app/immutable/entry/app.js?v=1',
					lineno: 3,
					colno: 14
				},
				base
			)
		).toEqual({
			name: 'Error',
			message: 'failed',
			stack: error.stack,
			filename: '/_app/immutable/entry/app.js',
			line: 3,
			column: 14
		});
	});

	it('falls back to the event message without an error object', () => {
		expect(
			describeErrorEvent(
				{ error: null, message: 'Script error.', filename: '', lineno: 0, colno: 0 },
				base
			)
		).toEqual({ message: 'Script error.' });
	});
});

describe('serializeDiagnostic', () => {
	const diagnostic = {
		type: 'window-error' as const,
		message: 'failed',
		timestamp: 1790000000000,
		pathname: '/',
		standalone: false,
		serviceWorkerControlled: false
	};

	it('keeps a stack that fits in the body limit', () => {
		const stack = 's'.repeat(4096);

		expect(JSON.parse(serializeDiagnostic({ ...diagnostic, stack })).stack).toBe(stack);
	});

	it('shortens the stack until the body fits in the limit', () => {
		const stack = 'あ'.repeat(4096);
		const body = serializeDiagnostic({ ...diagnostic, message: 'い'.repeat(1024), stack });

		expect(new TextEncoder().encode(body).byteLength).toBeLessThanOrEqual(8192);
		expect(stack.startsWith(JSON.parse(body).stack)).toBe(true);
	});
});

describe('createUnexpectedErrorReporter', () => {
	it('sends each type at most once', () => {
		const send = vi.fn();
		const report = createUnexpectedErrorReporter(send);

		report('window-error', () => ({ message: 'first' }));
		report('window-error', () => ({ message: 'second' }));
		report('unhandled-rejection', () => ({ message: 'rejected' }));
		report('sveltekit-handle-error', () => ({ message: 'load failed' }));
		report('unhandled-rejection', () => ({ message: 'rejected again' }));

		expect(send.mock.calls).toEqual([
			['window-error', { message: 'first' }],
			['unhandled-rejection', { message: 'rejected' }],
			['sveltekit-handle-error', { message: 'load failed' }]
		]);
	});

	it('does not throw or retry when reporting fails', () => {
		const send = vi.fn(() => {
			throw new Error('send failed');
		});
		const report = createUnexpectedErrorReporter(send);

		expect(() => report('window-error', () => ({ message: 'failed' }))).not.toThrow();
		expect(() =>
			report('unhandled-rejection', () => {
				throw new Error('describe failed');
			})
		).not.toThrow();
		report('window-error', () => ({ message: 'failed again' }));

		expect(send).toHaveBeenCalledTimes(1);
	});
});
