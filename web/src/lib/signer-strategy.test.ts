import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveSigner } from './signer-strategy';

function stubLogin(value: string | null): void {
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => (key === 'nostter:login' ? value : null),
		setItem: () => {},
		removeItem: () => {},
		clear: () => {}
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('resolveSigner', () => {
	it('resolves NIP-07', () => {
		stubLogin('NIP-07');
		const signer = resolveSigner();
		expect(signer.type).toBe('NIP-07');
		expect(signer.canSign).toBe(true);
	});

	it('resolves NIP-46 from bunker URL', () => {
		stubLogin('bunker://relay.example.com?pubkey=abc');
		const signer = resolveSigner();
		expect(signer.type).toBe('NIP-46');
		expect(signer.canSign).toBe(true);
	});

	it('resolves nsec', () => {
		stubLogin('nsec1abc');
		const signer = resolveSigner();
		expect(signer.type).toBe('nsec');
		expect(signer.canSign).toBe(true);
	});

	it('resolves npub as read-only', () => {
		stubLogin('npub1abc');
		const signer = resolveSigner();
		expect(signer.type).toBe('npub');
		expect(signer.canSign).toBe(false);
	});

	it('throws when login is missing', () => {
		stubLogin(null);
		expect(() => resolveSigner()).toThrow('[logic error]');
	});

	it('throws on unknown login', () => {
		stubLogin('garbage');
		expect(() => resolveSigner()).toThrow('[logic error]');
	});
});
