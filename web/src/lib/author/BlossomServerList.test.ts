import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools';
import { get, writable } from 'svelte/store';
import type { AccountLocalPreferences } from '$lib/preferences/AccountLocalPreferences';

const { preferencesByPubkey } = vi.hoisted(() => ({
	preferencesByPubkey: new Map<string, ReturnType<typeof writable<AccountLocalPreferences>>>()
}));
const { getServersFromServerListEvent } = vi.hoisted(() => ({
	getServersFromServerListEvent: vi.fn()
}));

vi.mock('$lib/preferences/AccountLocalPreferences', () => ({
	getAccountLocalPreferences: (pubkey: string) => {
		let preferences = preferencesByPubkey.get(pubkey);
		if (preferences === undefined) {
			preferences = writable({});
			preferencesByPubkey.set(pubkey, preferences);
		}
		return preferences;
	}
}));
vi.mock(import('blossom-client-sdk/nostr'), () => ({ getServersFromServerListEvent }));

import {
	getBlossomServer,
	resolveBlossomServer,
	updateBlossomServerList
} from './BlossomServerList.svelte';

const serverList = (tags: string[][]): Event =>
	({ kind: 10063, tags, content: '', created_at: 0, id: '', pubkey: '', sig: '' }) as Event;

describe('resolveBlossomServer', () => {
	it('selects the first HTTPS server in SDK-parsed tag order', () => {
		const event = serverList([]);
		getServersFromServerListEvent.mockReturnValue([
			new URL('http://insecure.example'),
			new URL('https://first.example/path'),
			new URL('https://second.example')
		]);
		expect(resolveBlossomServer(event).href).toBe('https://first.example/path');
	});

	it('does not select HTTP and falls back when no HTTPS server exists', () => {
		getServersFromServerListEvent.mockReturnValue([new URL('http://insecure.example')]);
		expect(resolveBlossomServer(serverList([])).href).toBe('https://blossom.band/');
	});
});

describe('Blossom server list state', () => {
	beforeEach(() => {
		preferencesByPubkey.clear();
		updateBlossomServerList('reset', undefined);
		getServersFromServerListEvent.mockReset();
	});

	it('updates memory and persisted preferences while Blossom is selected', () => {
		getServersFromServerListEvent.mockReturnValue([new URL('https://cdn.example')]);
		const pubkey = 'alice';
		preferencesByPubkey.set(
			pubkey,
			writable({
				mediaUploader: { type: 'blossom', server: 'https://previous.example' },
				futurePreference: true
			} as never)
		);
		updateBlossomServerList(pubkey, serverList([]));
		expect(getBlossomServer()?.href).toBe('https://cdn.example/');
		expect(get(preferencesByPubkey.get(pubkey)!)).toEqual({
			mediaUploader: { type: 'blossom', server: 'https://cdn.example/' },
			futurePreference: true
		});
	});

	it('updates memory but preserves a NIP-96 selection and server', () => {
		getServersFromServerListEvent.mockReturnValue([new URL('https://cdn.example')]);
		const preferences = writable<AccountLocalPreferences>({
			mediaUploader: { type: 'nip96', server: 'https://nostr.build' }
		});
		preferencesByPubkey.set('alice', preferences);
		updateBlossomServerList('alice', serverList([]));
		expect(getBlossomServer()?.href).toBe('https://cdn.example/');
		expect(get(preferences)).toEqual({
			mediaUploader: { type: 'nip96', server: 'https://nostr.build' }
		});
	});

	it('clears memory for an undefined event without overwriting the last-known server', () => {
		const preferences = writable<AccountLocalPreferences>({
			mediaUploader: { type: 'blossom', server: 'https://previous.example' }
		});
		preferencesByPubkey.set('alice', preferences);
		getServersFromServerListEvent.mockReturnValue([new URL('https://current.example')]);
		updateBlossomServerList('state-setup', serverList([]));
		updateBlossomServerList('alice', undefined);
		expect(getBlossomServer()).toBeUndefined();
		expect(get(preferences)).toEqual({
			mediaUploader: { type: 'blossom', server: 'https://previous.example' }
		});
	});
});
