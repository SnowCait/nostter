import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Signer } from './signer';
import { clearActiveSigner, getActiveSigner, setActiveSigner } from './active-signer';

const signer = {
	getPublicKey: vi.fn(),
	signEvent: vi.fn()
} satisfies Signer;

afterEach(() => {
	clearActiveSigner();
	vi.unstubAllGlobals();
});

describe('active signer', () => {
	it('throws when no signer is active', () => {
		expect(() => getActiveSigner()).toThrow('[logic error]');
	});

	it('returns the attached signer until it is cleared', () => {
		setActiveSigner(signer);
		expect(getActiveSigner()).toBe(signer);

		clearActiveSigner();
		expect(() => getActiveSigner()).toThrow('[logic error]');
	});

	it('does not read persisted login state', () => {
		vi.stubGlobal(
			'localStorage',
			new Proxy(
				{},
				{
					get() {
						throw new Error('localStorage was accessed');
					}
				}
			)
		);

		setActiveSigner(signer);
		expect(getActiveSigner()).toBe(signer);
	});
});
