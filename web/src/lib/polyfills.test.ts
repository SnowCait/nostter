import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const canParseDescriptor = Object.getOwnPropertyDescriptor(URL, 'canParse');
const withResolversDescriptor = Object.getOwnPropertyDescriptor(Promise, 'withResolvers');

describe('browser polyfills', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		if (canParseDescriptor) {
			Object.defineProperty(URL, 'canParse', canParseDescriptor);
		} else {
			Reflect.deleteProperty(URL, 'canParse');
		}
		if (withResolversDescriptor) {
			Object.defineProperty(Promise, 'withResolvers', withResolversDescriptor);
		} else {
			Reflect.deleteProperty(Promise, 'withResolvers');
		}
	});

	it('does not replace native implementations', async () => {
		const canParse = vi.fn(() => true);
		const withResolvers = vi.fn();
		Object.defineProperty(URL, 'canParse', { configurable: true, value: canParse });
		Object.defineProperty(Promise, 'withResolvers', {
			configurable: true,
			value: withResolvers
		});

		await import('./polyfills');

		expect(URL.canParse).toBe(canParse);
		expect(Promise.withResolvers).toBe(withResolvers);
	});

	it('adds URL.canParse with its existing behavior', async () => {
		Reflect.deleteProperty(URL, 'canParse');

		await import('./polyfills');

		expect(URL.canParse('https://example.com/path')).toBe(true);
		expect(URL.canParse('/path', 'https://example.com')).toBe(true);
		expect(URL.canParse('/path')).toBe(false);
	});

	it('adds a resolving Promise.withResolvers', async () => {
		Reflect.deleteProperty(Promise, 'withResolvers');

		await import('./polyfills');
		const { promise, resolve } = Promise.withResolvers<string>();
		resolve('resolved');

		await expect(promise).resolves.toBe('resolved');
	});

	it('adds a rejecting Promise.withResolvers', async () => {
		Reflect.deleteProperty(Promise, 'withResolvers');

		await import('./polyfills');
		const { promise, reject } = Promise.withResolvers<never>();
		const error = new Error('rejected');
		reject(error);

		await expect(promise).rejects.toBe(error);
	});
});
