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
	it('accepts NIP-07 as a signer login', () => {
		stubLogin('NIP-07');
		expect(() => resolveSigner()).not.toThrow();
	});

	it('accepts a bunker URL as a signer login', () => {
		stubLogin('bunker://relay.example.com?pubkey=abc');
		expect(() => resolveSigner()).not.toThrow();
	});

	it('accepts nsec as a signer login', () => {
		stubLogin('nsec1abc');
		expect(() => resolveSigner()).not.toThrow();
	});

	it('throws when login is npub because no signer is available', () => {
		stubLogin('npub1abc');
		expect(() => resolveSigner()).toThrow('[logic error]');
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
